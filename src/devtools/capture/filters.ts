import { compileRegex } from '@/shared/matcher';
import {
  CAPTURE_RESOURCE_TYPE_ORDER,
  type CaptureExcludeRule,
  type CaptureFilters,
  type CaptureResourceType,
  type CaptureUniqueConfig,
} from '@/shared/types';
import type { CapturedEntry } from './types';

// Chrome hands us a HAR entry with a non-standard `_resourceType` field. Its
// vocabulary is wider than our buckets, so fold the long tail into ours.
const HAR_RESOURCE_TYPE_MAP: Record<string, CaptureResourceType> = {
  xhr: 'xhr',
  fetch: 'xhr',
  preflight: 'xhr',
  eventsource: 'xhr',
  document: 'doc',
  iframe: 'doc',
  stylesheet: 'css',
  script: 'js',
  font: 'font',
  image: 'img',
  media: 'media',
  manifest: 'manifest',
  websocket: 'ws',
  webtransport: 'ws',
  wasm: 'wasm',
  other: 'other',
  ping: 'other',
  'signed-exchange': 'other',
  texttrack: 'media',
  cspviolationreport: 'other',
};

const MIME_PREFIX_MAP: ReadonlyArray<readonly [string, CaptureResourceType]> = [
  ['text/html', 'doc'],
  ['application/xhtml', 'doc'],
  ['text/css', 'css'],
  ['application/javascript', 'js'],
  ['text/javascript', 'js'],
  ['application/x-javascript', 'js'],
  ['application/wasm', 'wasm'],
  ['application/manifest+json', 'manifest'],
  ['font/', 'font'],
  ['application/font', 'font'],
  ['image/', 'img'],
  ['audio/', 'media'],
  ['video/', 'media'],
  ['application/json', 'xhr'],
  ['application/ld+json', 'xhr'],
  ['text/event-stream', 'xhr'],
];

const EXTENSION_MAP: Record<string, CaptureResourceType> = {
  html: 'doc',
  htm: 'doc',
  css: 'css',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'js',
  jsx: 'js',
  tsx: 'js',
  woff: 'font',
  woff2: 'font',
  ttf: 'font',
  otf: 'font',
  eot: 'font',
  png: 'img',
  jpg: 'img',
  jpeg: 'img',
  gif: 'img',
  webp: 'img',
  avif: 'img',
  svg: 'img',
  ico: 'img',
  bmp: 'img',
  mp4: 'media',
  webm: 'media',
  mp3: 'media',
  wav: 'media',
  ogg: 'media',
  m3u8: 'media',
  wasm: 'wasm',
  json: 'xhr',
};

export function extensionOf(pathOrUrl: string): string | null {
  const withoutQuery = pathOrUrl.split(/[?#]/)[0] ?? '';
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot <= 0 || dot === lastSegment.length - 1) return null;
  return lastSegment.slice(dot + 1).toLowerCase();
}

export interface ClassifyInput {
  harResourceType?: string | undefined;
  mimeType?: string | undefined;
  url?: string | undefined;
}

// Chrome's own bucket wins; mime type and extension are fallbacks for HAR
// imports and for entries captured before `_resourceType` was exposed.
export function classifyResourceType({
  harResourceType,
  mimeType,
  url,
}: ClassifyInput): CaptureResourceType {
  const harKey = harResourceType?.toLowerCase();
  if (harKey && Object.hasOwn(HAR_RESOURCE_TYPE_MAP, harKey)) {
    return HAR_RESOURCE_TYPE_MAP[harKey] as CaptureResourceType;
  }

  if (url && /^wss?:\/\//i.test(url)) return 'ws';

  const mime = (mimeType ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  if (mime) {
    for (const [prefix, type] of MIME_PREFIX_MAP) {
      if (mime.startsWith(prefix)) return type;
    }
  }

  const ext = url ? extensionOf(url) : null;
  // Own keys only — a URL ending in `.constructor` must not hit Object.prototype.
  if (ext && Object.hasOwn(EXTENSION_MAP, ext)) return EXTENSION_MAP[ext] as CaptureResourceType;

  return 'other';
}

const KNOWN_TYPES: ReadonlySet<string> = new Set(CAPTURE_RESOURCE_TYPE_ORDER);

// Buffer entries persisted by an older build have no resourceType. Derive one
// so type filtering works on them instead of dropping them into 'other'.
export function normalizeEntry(entry: CapturedEntry): CapturedEntry {
  if (KNOWN_TYPES.has(entry.resourceType)) return entry;
  return {
    ...entry,
    resourceType: classifyResourceType({
      mimeType: entry.responseContentType,
      url: entry.url,
    }),
  };
}

// Hostname without the port, so excluding `localhost` also covers
// `localhost:5173` (dev servers, HMR sockets).
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function statusPartMatches(status: number, part: string): boolean {
  if (/^\d{1,3}$/.test(part)) return status === Number(part);
  if (/^\dxx$/.test(part)) return Math.floor(status / 100) === Number(part[0]);
  const range = /^(\d{1,3})-(\d{1,3})$/.exec(part);
  if (!range) return false;
  const a = Number(range[1]);
  const b = Number(range[2]);
  return status >= Math.min(a, b) && status <= Math.max(a, b);
}

// Supports exact codes ("404", "0" for failed requests), class wildcards
// ("4xx"), ranges ("500-599") and comma/space separated lists ("204, 3xx").
function statusMatches(status: number, pattern: string): boolean {
  return pattern
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')
    .split(/[\s,]+/)
    .some((part) => part !== '' && statusPartMatches(status, part));
}

export function matchesExclude(entry: CapturedEntry, rule: CaptureExcludeRule): boolean {
  const value = rule.value.trim();
  if (!value) return false;
  const needle = value.toLowerCase();

  switch (rule.kind) {
    case 'domain': {
      const host = hostOf(entry.url) || entry.host.toLowerCase().replace(/:\d+$/, '');
      const bare = needle.replace(/^\./, '');
      return host === bare || host.endsWith(`.${bare}`);
    }
    case 'path': {
      const path = pathOf(entry.url).toLowerCase();
      const prefix = needle.startsWith('/') ? needle : `/${needle}`;
      return path.startsWith(prefix);
    }
    case 'contains':
      return entry.url.toLowerCase().includes(needle);
    case 'regex': {
      const re = compileRegex(value);
      return re ? re.test(entry.url) : false;
    }
    case 'extension': {
      const ext = extensionOf(entry.url);
      return ext !== null && ext === needle.replace(/^\./, '');
    }
    case 'method':
      return entry.method.toLowerCase() === needle;
    case 'status':
      return statusMatches(entry.status, value);
  }
}

export function isExcluded(entry: CapturedEntry, excludes: CaptureExcludeRule[]): boolean {
  return excludes.some((rule) => rule.enabled && matchesExclude(entry, rule));
}

export function passesTypeFilter(
  entry: CapturedEntry,
  types: Record<CaptureResourceType, boolean>
): boolean {
  return types[entry.resourceType] !== false;
}

// The identity of a request under the current uniqueness settings. Bodies are
// hashed rather than concatenated so a buffer of large responses stays cheap.
export function uniqueKeyOf(entry: CapturedEntry, unique: CaptureUniqueConfig): string {
  const parts: string[] = [];
  if (unique.byMethod) parts.push(entry.method.toUpperCase());
  if (unique.byUrl) parts.push(entry.url);
  if (unique.byRequestBody) parts.push(hashBody(entry.requestBody));
  if (unique.byResponseBody) parts.push(hashBody(entry.responseBody));
  // Every key off would make all requests identical — fall back to the URL.
  if (parts.length === 0) parts.push(entry.url);
  return parts.join('\u0000');
}

function hashBody(body: string | null): string {
  if (body === null || body === '') return '-';
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}:${body.length}`;
}

// Keeps the first occurrence of each key so the earliest response body (the
// one already promoted to a rule, typically) survives.
export function dedupeEntries(
  entries: CapturedEntry[],
  unique: CaptureUniqueConfig
): CapturedEntry[] {
  if (!unique.enabled) return entries;
  const seen = new Set<string>();
  const out: CapturedEntry[] = [];
  for (const entry of entries) {
    const key = uniqueKeyOf(entry, unique);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

export function isPreflight(entry: CapturedEntry): boolean {
  return entry.method.toUpperCase() === 'OPTIONS';
}

export function shouldCapture(entry: CapturedEntry, filters: CaptureFilters): boolean {
  if (filters.ignoreOptions && isPreflight(entry)) return false;
  return passesTypeFilter(entry, filters.types) && !isExcluded(entry, filters.excludes);
}

export function applyCaptureFilters(
  entries: CapturedEntry[],
  filters: CaptureFilters
): CapturedEntry[] {
  const kept = entries.map(normalizeEntry).filter((e) => shouldCapture(e, filters));
  return dedupeEntries(kept, filters.unique);
}

export function countActiveFilters(filters: CaptureFilters): number {
  const disabledTypes = CAPTURE_RESOURCE_TYPE_ORDER.filter((t) => !filters.types[t]).length;
  const activeExcludes = filters.excludes.filter((e) => e.enabled && e.value.trim()).length;
  return (
    disabledTypes +
    activeExcludes +
    (filters.unique.enabled ? 1 : 0) +
    (filters.ignoreOptions ? 1 : 0)
  );
}
