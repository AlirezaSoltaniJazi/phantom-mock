import { describe, expect, it } from 'vitest';
import {
  applyCaptureFilters,
  classifyResourceType,
  countActiveFilters,
  dedupeEntries,
  extensionOf,
  isExcluded,
  isPreflight,
  matchesExclude,
  normalizeEntry,
  passesTypeFilter,
  shouldCapture,
  uniqueKeyOf,
} from '@/devtools/capture/filters';
import {
  DEFAULT_CAPTURE_FILTERS,
  DEFAULT_CAPTURE_TYPES,
  DEFAULT_CAPTURE_UNIQUE,
  type CaptureExcludeRule,
  type CaptureFilters,
  type CaptureResourceType,
} from '@/shared/types';
import type { CapturedEntry } from '@/devtools/capture/types';

function makeEntry(overrides: Partial<CapturedEntry> = {}): CapturedEntry {
  const url = overrides.url ?? 'https://api.example.com/v1/users?page=2';
  let host = '';
  let path = url;
  try {
    const u = new URL(url);
    host = u.host;
    path = `${u.pathname}${u.search}`;
  } catch {
    /* non-URL test input */
  }
  return {
    id: 'cap_1',
    ts: 1_700_000_000_000,
    method: 'GET',
    url,
    host,
    path,
    status: 200,
    statusText: 'OK',
    durationMs: 120,
    requestHeaders: [{ name: 'accept', value: 'application/json' }],
    requestBody: null,
    requestContentType: null,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }],
    responseBody: '{"ok":true}',
    responseContentType: 'application/json',
    responseEncoding: 'utf8',
    resourceType: 'xhr',
    ...overrides,
  };
}

function filters(overrides: Partial<CaptureFilters> = {}): CaptureFilters {
  return {
    excludes: [],
    types: { ...DEFAULT_CAPTURE_TYPES },
    unique: { ...DEFAULT_CAPTURE_UNIQUE },
    ignoreOptions: false,
    ...overrides,
  };
}

function exclude(over: Partial<CaptureExcludeRule>): CaptureExcludeRule {
  return { id: 'cex_1', kind: 'domain', value: '', enabled: true, ...over };
}

describe('classifyResourceType', () => {
  it("maps Chrome's HAR resource types onto our buckets", () => {
    expect(classifyResourceType({ harResourceType: 'fetch' })).toBe('xhr');
    expect(classifyResourceType({ harResourceType: 'xhr' })).toBe('xhr');
    expect(classifyResourceType({ harResourceType: 'preflight' })).toBe('xhr');
    expect(classifyResourceType({ harResourceType: 'document' })).toBe('doc');
    expect(classifyResourceType({ harResourceType: 'stylesheet' })).toBe('css');
    expect(classifyResourceType({ harResourceType: 'script' })).toBe('js');
    expect(classifyResourceType({ harResourceType: 'websocket' })).toBe('ws');
  });

  it('falls back to the mime type when Chrome gives no resource type', () => {
    expect(classifyResourceType({ mimeType: 'text/css' })).toBe('css');
    expect(classifyResourceType({ mimeType: 'image/png' })).toBe('img');
    expect(classifyResourceType({ mimeType: 'application/json; charset=utf-8' })).toBe('xhr');
    expect(classifyResourceType({ mimeType: 'font/woff2' })).toBe('font');
  });

  it('falls back to the file extension, then to "other"', () => {
    expect(classifyResourceType({ url: 'https://x.dev/app.js' })).toBe('js');
    expect(classifyResourceType({ url: 'https://x.dev/a/b.woff2?v=3' })).toBe('font');
    expect(classifyResourceType({ url: 'https://x.dev/opaque' })).toBe('other');
  });

  it('treats ws:// and wss:// urls as websockets', () => {
    expect(classifyResourceType({ url: 'wss://x.dev/socket' })).toBe('ws');
  });
});

describe('extensionOf', () => {
  it('ignores query strings and dotfiles', () => {
    expect(extensionOf('/a/b/c.png?x=1#y')).toBe('png');
    expect(extensionOf('/a/b/.env')).toBeNull();
    expect(extensionOf('/a/b/c')).toBeNull();
    expect(extensionOf('/a/b/c.')).toBeNull();
  });
});

describe('normalizeEntry', () => {
  it('derives a resource type for entries stored before the field existed', () => {
    const legacy = makeEntry({ responseContentType: 'text/css', url: 'https://x.dev/a.css' });
    delete (legacy as Partial<CapturedEntry>).resourceType;
    expect(normalizeEntry(legacy).resourceType).toBe('css');
  });

  it('leaves a valid resource type untouched', () => {
    const entry = makeEntry({ resourceType: 'img' });
    expect(normalizeEntry(entry)).toBe(entry);
  });
});

describe('matchesExclude', () => {
  it('matches a domain exactly and by subdomain suffix', () => {
    const entry = makeEntry({ url: 'https://cdn.assets.example.com/a.png' });
    expect(matchesExclude(entry, exclude({ kind: 'domain', value: 'example.com' }))).toBe(true);
    expect(matchesExclude(entry, exclude({ kind: 'domain', value: '.example.com' }))).toBe(true);
    expect(matchesExclude(entry, exclude({ kind: 'domain', value: 'notexample.com' }))).toBe(false);
    // A suffix that isn't on a label boundary must not match.
    expect(matchesExclude(entry, exclude({ kind: 'domain', value: 'ample.com' }))).toBe(false);
  });

  it('matches a path prefix with or without the leading slash', () => {
    const entry = makeEntry({ url: 'https://x.dev/static/js/app.js' });
    expect(matchesExclude(entry, exclude({ kind: 'path', value: '/static/' }))).toBe(true);
    expect(matchesExclude(entry, exclude({ kind: 'path', value: 'static' }))).toBe(true);
    expect(matchesExclude(entry, exclude({ kind: 'path', value: '/api' }))).toBe(false);
  });

  it('matches a case-insensitive substring of the url', () => {
    const entry = makeEntry({ url: 'https://x.dev/SockJS-node/info' });
    expect(matchesExclude(entry, exclude({ kind: 'contains', value: 'sockjs' }))).toBe(true);
  });

  it('matches a regex and treats an invalid one as no match', () => {
    const entry = makeEntry({ url: 'https://x.dev/img/logo.svg' });
    expect(matchesExclude(entry, exclude({ kind: 'regex', value: '\\.(png|svg)$' }))).toBe(true);
    expect(matchesExclude(entry, exclude({ kind: 'regex', value: '([' }))).toBe(false);
  });

  it('matches an extension with or without the dot', () => {
    const entry = makeEntry({ url: 'https://x.dev/f/a.woff2?v=1' });
    expect(matchesExclude(entry, exclude({ kind: 'extension', value: 'woff2' }))).toBe(true);
    expect(matchesExclude(entry, exclude({ kind: 'extension', value: '.woff2' }))).toBe(true);
    expect(matchesExclude(entry, exclude({ kind: 'extension', value: 'woff' }))).toBe(false);
  });

  it('matches a method case-insensitively', () => {
    expect(
      matchesExclude(
        makeEntry({ method: 'OPTIONS' }),
        exclude({ kind: 'method', value: 'options' })
      )
    ).toBe(true);
  });

  it('matches a status code, a class wildcard and a range', () => {
    const e304 = makeEntry({ status: 304 });
    expect(matchesExclude(e304, exclude({ kind: 'status', value: '304' }))).toBe(true);
    expect(matchesExclude(e304, exclude({ kind: 'status', value: '3xx' }))).toBe(true);
    expect(matchesExclude(e304, exclude({ kind: 'status', value: '300-310' }))).toBe(true);
    expect(matchesExclude(e304, exclude({ kind: 'status', value: '4xx' }))).toBe(false);
    expect(matchesExclude(e304, exclude({ kind: 'status', value: 'nonsense' }))).toBe(false);
  });

  it('never matches on an empty value', () => {
    for (const kind of ['domain', 'path', 'contains', 'regex', 'extension', 'method'] as const) {
      expect(matchesExclude(makeEntry(), exclude({ kind, value: '   ' }))).toBe(false);
    }
  });
});

describe('isExcluded', () => {
  it('ignores disabled rules', () => {
    const entry = makeEntry({ url: 'https://ads.example.com/t.gif' });
    const rules = [exclude({ kind: 'domain', value: 'ads.example.com', enabled: false })];
    expect(isExcluded(entry, rules)).toBe(false);
    expect(isExcluded(entry, [{ ...rules[0]!, enabled: true }])).toBe(true);
  });
});

describe('passesTypeFilter', () => {
  it('drops entries whose bucket is toggled off', () => {
    const types = { ...DEFAULT_CAPTURE_TYPES, img: false } as Record<CaptureResourceType, boolean>;
    expect(passesTypeFilter(makeEntry({ resourceType: 'img' }), types)).toBe(false);
    expect(passesTypeFilter(makeEntry({ resourceType: 'xhr' }), types)).toBe(true);
  });
});

describe('uniqueKeyOf / dedupeEntries', () => {
  const unique = { ...DEFAULT_CAPTURE_UNIQUE, enabled: true };

  it('collapses repeat calls to the same url + method', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' }), makeEntry({ id: 'c' })];
    const out = dedupeEntries(entries, unique);
    expect(out.map((e) => e.id)).toEqual(['a']);
  });

  it('keeps same-url calls apart when they carry different payloads', () => {
    const base = { method: 'POST', url: 'https://api.example.com/search' };
    const entries = [
      makeEntry({ ...base, id: 'a', requestBody: '{"q":"cats"}' }),
      makeEntry({ ...base, id: 'b', requestBody: '{"q":"dogs"}' }),
      makeEntry({ ...base, id: 'c', requestBody: '{"q":"cats"}' }),
    ];
    expect(dedupeEntries(entries, unique).map((e) => e.id)).toEqual(['a']);
    const withPayload = { ...unique, byRequestBody: true };
    expect(dedupeEntries(entries, withPayload).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('can split on the response body alone', () => {
    const entries = [
      makeEntry({ id: 'a', responseBody: '{"n":1}' }),
      makeEntry({ id: 'b', responseBody: '{"n":2}' }),
      makeEntry({ id: 'c', responseBody: '{"n":1}' }),
    ];
    const byResponse = { ...unique, byUrl: false, byMethod: false, byResponseBody: true };
    expect(dedupeEntries(entries, byResponse).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('is a no-op when uniqueness is off', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    expect(dedupeEntries(entries, { ...unique, enabled: false })).toBe(entries);
  });

  it('falls back to the url when every key is unticked', () => {
    const none = {
      enabled: true,
      byUrl: false,
      byMethod: false,
      byRequestBody: false,
      byResponseBody: false,
    };
    const a = makeEntry({ url: 'https://x.dev/a' });
    const b = makeEntry({ url: 'https://x.dev/b' });
    expect(uniqueKeyOf(a, none)).not.toBe(uniqueKeyOf(b, none));
  });

  it('distinguishes bodies of equal length', () => {
    const a = makeEntry({ responseBody: '{"n":1}' });
    const b = makeEntry({ responseBody: '{"n":2}' });
    const byResponse = { ...unique, byResponseBody: true };
    expect(uniqueKeyOf(a, byResponse)).not.toBe(uniqueKeyOf(b, byResponse));
  });
});

describe('ignoreOptions', () => {
  it('drops CORS preflights only when the toggle is on', () => {
    const preflight = makeEntry({ method: 'OPTIONS', status: 204 });
    expect(shouldCapture(preflight, filters())).toBe(true);
    expect(shouldCapture(preflight, filters({ ignoreOptions: true }))).toBe(false);
  });

  it('leaves every other method alone', () => {
    const on = filters({ ignoreOptions: true });
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      expect(shouldCapture(makeEntry({ method }), on)).toBe(true);
    }
  });

  it('matches the method case-insensitively', () => {
    expect(isPreflight(makeEntry({ method: 'options' }))).toBe(true);
    expect(isPreflight(makeEntry({ method: 'GET' }))).toBe(false);
  });
});

describe('applyCaptureFilters', () => {
  it('drops excluded and type-filtered entries, then dedupes what is left', () => {
    const entries = [
      makeEntry({ id: 'api1', url: 'https://api.example.com/v1/me' }),
      makeEntry({ id: 'api2', url: 'https://api.example.com/v1/me' }),
      makeEntry({ id: 'img', url: 'https://api.example.com/a.png', resourceType: 'img' }),
      makeEntry({ id: 'ads', url: 'https://ads.tracker.com/hit', resourceType: 'xhr' }),
    ];
    const out = applyCaptureFilters(
      entries,
      filters({
        types: { ...DEFAULT_CAPTURE_TYPES, img: false },
        excludes: [exclude({ kind: 'domain', value: 'tracker.com' })],
        unique: { ...DEFAULT_CAPTURE_UNIQUE, enabled: true },
      })
    );
    expect(out.map((e) => e.id)).toEqual(['api1']);
  });

  it('passes everything through with default filters', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b', url: 'https://x.dev/b' })];
    expect(applyCaptureFilters(entries, DEFAULT_CAPTURE_FILTERS)).toHaveLength(2);
  });
});

describe('countActiveFilters', () => {
  it('counts disabled types, enabled non-empty exclusions and unique mode', () => {
    expect(countActiveFilters(DEFAULT_CAPTURE_FILTERS)).toBe(0);
    expect(
      countActiveFilters(
        filters({
          types: { ...DEFAULT_CAPTURE_TYPES, img: false, font: false },
          excludes: [
            exclude({ id: '1', kind: 'domain', value: 'a.com' }),
            exclude({ id: '2', kind: 'domain', value: '  ' }),
            exclude({ id: '3', kind: 'domain', value: 'b.com', enabled: false }),
          ],
          unique: { ...DEFAULT_CAPTURE_UNIQUE, enabled: true },
          ignoreOptions: true,
        })
      )
    ).toBe(5);
  });
});
