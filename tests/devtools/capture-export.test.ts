import { describe, expect, it } from 'vitest';
import {
  buildCombinedDocument,
  buildCurl,
  buildEntryDocument,
  buildExport,
  buildJsonDocument,
  fileNameFor,
} from '@/devtools/capture/export';
import { DEFAULT_CAPTURE_EXPORT, type CaptureExportOptions } from '@/shared/types';
import type { CapturedEntry } from '@/devtools/capture/types';

function makeEntry(overrides: Partial<CapturedEntry> = {}): CapturedEntry {
  return {
    id: 'cap_1',
    ts: Date.parse('2026-09-21T10:30:00.000Z'),
    method: 'POST',
    url: 'https://api.example.com/v1/users?page=2',
    host: 'api.example.com',
    path: '/v1/users?page=2',
    status: 201,
    statusText: 'Created',
    durationMs: 143,
    requestHeaders: [
      { name: 'content-type', value: 'application/json' },
      { name: 'authorization', value: 'Bearer tok' },
      { name: 'content-length', value: '17' },
      { name: ':method', value: 'POST' },
    ],
    requestBody: '{"name":"ada"}',
    requestContentType: 'application/json',
    responseHeaders: [{ name: 'content-type', value: 'application/json' }],
    responseBody: '{"id":7,"name":"ada"}',
    responseContentType: 'application/json',
    responseEncoding: 'utf8',
    resourceType: 'xhr',
    ...overrides,
  };
}

function options(overrides: Partial<CaptureExportOptions> = {}): CaptureExportOptions {
  return {
    fields: { ...DEFAULT_CAPTURE_EXPORT.fields },
    format: DEFAULT_CAPTURE_EXPORT.format,
    ...overrides,
  };
}

describe('buildCurl', () => {
  it('emits the url, method, headers and body', () => {
    const curl = buildCurl(makeEntry());
    expect(curl).toContain("curl 'https://api.example.com/v1/users?page=2'");
    expect(curl).toContain('-X POST');
    expect(curl).toContain("-H 'content-type: application/json'");
    expect(curl).toContain('--data-raw \'{"name":"ada"}\'');
  });

  it('omits -X for GET', () => {
    expect(buildCurl(makeEntry({ method: 'GET', requestBody: null }))).not.toContain('-X');
  });

  it('drops HTTP/2 pseudo-headers and headers curl sets itself', () => {
    const curl = buildCurl(makeEntry());
    expect(curl).not.toContain(':method');
    expect(curl).not.toContain('content-length');
  });

  it('escapes single quotes so the command stays valid shell', () => {
    const curl = buildCurl(makeEntry({ requestBody: `{"q":"it's"}` }));
    expect(curl).toContain(`'{"q":"it'\\''s"}'`);
  });
});

describe('buildEntryDocument', () => {
  it('includes each selected field and omits the rest', () => {
    const doc = buildEntryDocument(makeEntry(), options());
    expect(doc).toContain('# POST /v1/users?page=2');
    expect(doc).toContain('- Status: 201 Created');
    expect(doc).toContain('- Duration: 143ms');
    expect(doc).toContain('- Size: ');
    expect(doc).toContain('- Type: Fetch/XHR');
    expect(doc).toContain('## Request (curl)');
    expect(doc).toContain('## Response headers');
    expect(doc).toContain('## Response body');
    // Off by default — curl already carries them.
    expect(doc).not.toContain('## Request headers');
    expect(doc).not.toContain('## Request body');
  });

  it('drops every optional section when all fields are unticked', () => {
    const none = options({
      fields: Object.fromEntries(
        Object.keys(DEFAULT_CAPTURE_EXPORT.fields).map((k) => [k, false])
      ) as CaptureExportOptions['fields'],
    });
    const doc = buildEntryDocument(makeEntry(), none);
    expect(doc).toContain('- URL: https://api.example.com/v1/users?page=2');
    expect(doc).not.toContain('## ');
    expect(doc).not.toContain('- Status:');
  });

  it('pretty-prints JSON bodies and labels base64 responses', () => {
    const doc = buildEntryDocument(makeEntry(), options());
    expect(doc).toContain('"name": "ada"');
    const b64 = buildEntryDocument(
      makeEntry({
        responseEncoding: 'base64',
        responseBody: 'AAAA',
        responseContentType: 'image/png',
      }),
      options()
    );
    expect(b64).toContain('## Response body (base64)');
  });

  it('widens the fence when the body itself contains backticks', () => {
    const doc = buildEntryDocument(
      makeEntry({ responseBody: '```\ncode\n```', responseContentType: 'text/plain' }),
      options()
    );
    expect(doc).toContain('````');
  });

  it('says so when no body was captured', () => {
    const doc = buildEntryDocument(makeEntry({ responseBody: null }), options());
    expect(doc).toContain('(no body captured)');
  });
});

describe('fileNameFor', () => {
  it('numbers files and slugifies host + path', () => {
    expect(fileNameFor(makeEntry(), 0)).toBe('001-POST-api-example-com-v1-users-page-2.md');
    expect(fileNameFor(makeEntry(), 11)).toMatch(/^012-POST-/);
  });

  it('falls back to "request" when nothing survives slugification', () => {
    expect(fileNameFor(makeEntry({ host: '', path: '' }), 0)).toBe('001-POST-request.md');
  });
});

describe('buildCombinedDocument', () => {
  it('joins every entry with a horizontal rule and a count header', () => {
    const doc = buildCombinedDocument([makeEntry(), makeEntry({ id: 'b' })], options());
    expect(doc).toContain('# Phantom Mock capture — 2 requests');
    expect(doc.match(/^---$/gm)).toHaveLength(2);
  });
});

describe('buildJsonDocument', () => {
  it('emits only the selected fields', () => {
    const json = JSON.parse(buildJsonDocument([makeEntry()], options())) as Record<
      string,
      unknown
    >[];
    expect(json[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.example.com/v1/users?page=2',
      status: 201,
      durationMs: 143,
      resourceType: 'xhr',
    });
    expect(json[0]).toHaveProperty('curl');
    expect(json[0]).not.toHaveProperty('requestHeaders');
  });
});

describe('buildExport', () => {
  const now = new Date('2026-09-21T10:30:00.000Z');

  it('names and types the artifact per format', () => {
    const entries = [makeEntry()];
    expect(buildExport(entries, options({ format: 'json' }), now)).toMatchObject({
      fileName: 'phantom-mock-capture-2026-09-21T10-30-00.json',
    });
    expect(buildExport(entries, options({ format: 'single' }), now).fileName).toMatch(/\.md$/);
    const zip = buildExport(entries, options({ format: 'files' }), now);
    expect(zip.fileName).toMatch(/\.zip$/);
    expect(zip.blob.type).toBe('application/zip');
  });

  it('puts one file per request in the zip', async () => {
    const zip = buildExport([makeEntry(), makeEntry({ id: 'b' })], options(), now);
    const text = new TextDecoder().decode(await zip.blob.arrayBuffer());
    expect(text).toContain('001-POST-api-example-com-v1-users-page-2.md');
    expect(text).toContain('002-POST-api-example-com-v1-users-page-2.md');
  });
});
