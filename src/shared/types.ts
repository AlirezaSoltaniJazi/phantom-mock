export type UrlMatchType = 'exact' | 'contains' | 'regex' | 'template';

export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  '*',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type HeaderOpKind = 'set' | 'append' | 'remove';

export interface HeaderOp {
  name: string;
  value?: string;
  op: HeaderOpKind;
}

export interface MatchSpec {
  method: HttpMethod;
  urlMatchType: UrlMatchType;
  urlPattern: string;
}

export interface MockAction {
  kind: 'mock';
  statusCode: number;
  delayMs: number;
  responseBody: string;
  responseContentType: string;
  responseHeaders: HeaderOp[];
  logToPanel: boolean;
}

export interface HeaderAction {
  kind: 'header';
  requestHeaders: HeaderOp[];
  responseHeaders: HeaderOp[];
}

export type RuleAction = MockAction | HeaderAction;

export interface Rule {
  id: string;
  name: string;
  groupId: string;
  enabled: boolean;
  match: MatchSpec;
  action: RuleAction;
}

// Optional, additive activation gate for a group. When present, the group's
// rules only apply while the current PAGE (tab) URL satisfies the condition;
// when absent (or empty), the group is always active while enabled (the
// original behavior). This is the address-bar URL, not the per-request endpoint
// URL — e.g. open `…/overview/therapy-details` and a group gated on
// `overview/therapy-details` mocks every endpoint that page calls.
export interface GroupActivation {
  // Active only when `window.location.href` contains this substring.
  pageUrlContains?: string;
}

export interface Group {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  // Omit the key entirely when there is no condition (exactOptionalPropertyTypes).
  activation?: GroupActivation;
}

export interface StorageProfile {
  id: string;
  name: string;
  key: string;
  values: string[];
  // Optional wrappers applied when SETTING a value: the actual string stored
  // in localStorage is `prefix + value + suffix`. Useful for e.g. JSON quoting
  // (prefix=`"`, suffix=`"`) or fragments like `{"locale":"…"}`.
  prefix?: string;
  suffix?: string;
  enabled: boolean;
}

export interface CookieProfile {
  id: string;
  // Human-friendly label shown in the panel (e.g. "Language").
  name: string;
  // The actual cookie name written via chrome.cookies (e.g. "app_locale").
  cookieName: string;
  // Cookie path. Defaults to '/' at write time when missing.
  path?: string;
  values: string[];
  // Optional wrappers applied when SETTING a value: the stored cookie value is
  // `prefix + value + suffix`. Mirrors StorageProfile prefix/suffix semantics.
  prefix?: string;
  suffix?: string;
  enabled: boolean;
}

export interface DnrMatchEntry {
  ts: number;
  dnrRuleId: number;
  ruleName: string | null;
  ruleId: string | null;
  url: string;
  method: string;
}

export interface MockHit {
  ruleId: string;
  ruleName: string;
  url: string;
  method: string;
  statusCode: number;
  delayMs: number;
  ts: number;
  tabId?: number;
}

export const CURRENT_SCHEMA_VERSION = 1 as const;

export interface AppState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  masterEnabled: boolean;
  groups: Group[];
  rules: Rule[];
  storageProfiles: StorageProfile[];
  cookieProfiles: CookieProfile[];
}

export interface ExportBundle {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  exportedAt: string;
  groups: Group[];
  rules: Rule[];
  storageProfiles?: StorageProfile[];
  cookieProfiles?: CookieProfile[];
}

export type ImportStrategy = 'replace' | 'merge-by-id' | 'append-as-new';

export type FontSizeMode = 'small' | 'normal' | 'big' | 'custom';

export type CaptureColumn = 'time' | 'method' | 'status' | 'path' | 'type' | 'size' | 'duration';

export const CAPTURE_COLUMN_ORDER: readonly CaptureColumn[] = [
  'time',
  'method',
  'status',
  'path',
  'type',
  'size',
  'duration',
];

export const CAPTURE_COLUMN_LABELS: Record<CaptureColumn, string> = {
  time: 'Time',
  method: 'Method',
  status: 'Status',
  path: 'Path',
  type: 'Type',
  size: 'Size',
  duration: 'Duration',
};

// ─── Capture filtering ───────────────────────────────────────────────────────

// DevTools Network-panel style resource buckets. Mirrors the filter chips
// Chrome itself shows (Fetch/XHR, Doc, CSS, …) so the mental model carries over.
export type CaptureResourceType =
  'xhr' | 'doc' | 'css' | 'js' | 'font' | 'img' | 'media' | 'manifest' | 'ws' | 'wasm' | 'other';

export const CAPTURE_RESOURCE_TYPE_ORDER: readonly CaptureResourceType[] = [
  'xhr',
  'doc',
  'css',
  'js',
  'font',
  'img',
  'media',
  'manifest',
  'ws',
  'wasm',
  'other',
];

export const CAPTURE_RESOURCE_TYPE_LABELS: Record<CaptureResourceType, string> = {
  xhr: 'Fetch/XHR',
  doc: 'Doc',
  css: 'CSS',
  js: 'JS',
  font: 'Font',
  img: 'Img',
  media: 'Media',
  manifest: 'Manifest',
  ws: 'WS',
  wasm: 'Wasm',
  other: 'Other',
};

// Everything on by default so enabling the feature doesn't silently drop
// traffic people were already capturing.
export const DEFAULT_CAPTURE_TYPES: Record<CaptureResourceType, boolean> = {
  xhr: true,
  doc: true,
  css: true,
  js: true,
  font: true,
  img: true,
  media: true,
  manifest: true,
  ws: true,
  wasm: true,
  other: true,
};

export type CaptureExcludeKind =
  'domain' | 'path' | 'contains' | 'regex' | 'extension' | 'method' | 'status';

export const CAPTURE_EXCLUDE_KIND_ORDER: readonly CaptureExcludeKind[] = [
  'domain',
  'path',
  'contains',
  'regex',
  'extension',
  'method',
  'status',
];

export const CAPTURE_EXCLUDE_KIND_LABELS: Record<CaptureExcludeKind, string> = {
  domain: 'Domain is / ends with',
  path: 'Path starts with',
  contains: 'URL contains',
  regex: 'URL matches regex',
  extension: 'File extension',
  method: 'Method is',
  status: 'Status code',
};

export const CAPTURE_EXCLUDE_KIND_PLACEHOLDERS: Record<CaptureExcludeKind, string> = {
  domain: 'google-analytics.com',
  path: '/static/',
  contains: 'sockjs-node',
  regex: '\\.(png|jpe?g|svg)(\\?|$)',
  extension: 'woff2',
  method: 'OPTIONS',
  status: '204 or 3xx',
};

export interface CaptureExcludeRule {
  id: string;
  kind: CaptureExcludeKind;
  value: string;
  enabled: boolean;
}

// Which parts of a request make it "the same request" as an earlier one.
// url+method alone means a repeated poll is captured once; adding requestBody
// keeps two POSTs to the same endpoint with different payloads.
export interface CaptureUniqueConfig {
  enabled: boolean;
  byUrl: boolean;
  byMethod: boolean;
  byRequestBody: boolean;
  byResponseBody: boolean;
}

export const DEFAULT_CAPTURE_UNIQUE: CaptureUniqueConfig = {
  enabled: false,
  byUrl: true,
  byMethod: true,
  byRequestBody: false,
  byResponseBody: false,
};

export interface CaptureFilters {
  excludes: CaptureExcludeRule[];
  types: Record<CaptureResourceType, boolean>;
  unique: CaptureUniqueConfig;
  // CORS preflights: same URL as the call that follows, no body, nothing to
  // mock. Shortcut for the equivalent `method is OPTIONS` exclusion.
  ignoreOptions: boolean;
}

export const DEFAULT_CAPTURE_FILTERS: CaptureFilters = {
  excludes: [],
  types: { ...DEFAULT_CAPTURE_TYPES },
  unique: { ...DEFAULT_CAPTURE_UNIQUE },
  ignoreOptions: false,
};

// ─── Capture export ──────────────────────────────────────────────────────────

export type CaptureExportField =
  | 'timestamp'
  | 'status'
  | 'duration'
  | 'size'
  | 'resourceType'
  | 'curl'
  | 'requestHeaders'
  | 'requestBody'
  | 'responseHeaders'
  | 'responseBody';

export const CAPTURE_EXPORT_FIELD_ORDER: readonly CaptureExportField[] = [
  'timestamp',
  'status',
  'duration',
  'size',
  'resourceType',
  'curl',
  'requestHeaders',
  'requestBody',
  'responseHeaders',
  'responseBody',
];

export const CAPTURE_EXPORT_FIELD_LABELS: Record<CaptureExportField, string> = {
  timestamp: 'Timestamp',
  status: 'Status code',
  duration: 'Duration',
  size: 'Response size',
  resourceType: 'Resource type',
  curl: 'Request as curl',
  requestHeaders: 'Request headers (list)',
  requestBody: 'Request body (raw)',
  responseHeaders: 'Response headers',
  responseBody: 'Response body',
};

// 'files' = one file per request inside a zip, 'single' = one combined
// markdown file, 'json' = machine-readable array.
export type CaptureExportFormat = 'files' | 'single' | 'json';

export interface CaptureExportOptions {
  fields: Record<CaptureExportField, boolean>;
  format: CaptureExportFormat;
  // Off by default: credential headers (Authorization, Cookie, Set-Cookie, API
  // keys) are masked so an export can be pasted into a ticket or chat safely.
  includeSecrets: boolean;
}

// curl already carries the request headers and body, so those two are off by
// default to avoid repeating them in every file.
export const DEFAULT_CAPTURE_EXPORT: CaptureExportOptions = {
  fields: {
    timestamp: true,
    status: true,
    duration: true,
    size: true,
    resourceType: true,
    curl: true,
    requestHeaders: false,
    requestBody: false,
    responseHeaders: true,
    responseBody: true,
  },
  format: 'files',
  includeSecrets: false,
};

export interface UIPreferences {
  fontSizeMode: FontSizeMode;
  fontSizeCustomPx: number;
  showToast: boolean;
  captureColumns: Record<CaptureColumn, boolean>;
  captureFilters: CaptureFilters;
  captureExport: CaptureExportOptions;
  autoReloadOnStorageSwitch: boolean;
  // Group ids hidden from the browser-action popup (opt-out, so new groups are
  // visible by default). UI-only preference — does NOT affect whether a group's
  // rules apply (that's Group.enabled) and is NOT part of rules export/import.
  hiddenPopupGroupIds: string[];
}

export const DEFAULT_CAPTURE_COLUMNS: Record<CaptureColumn, boolean> = {
  time: true,
  method: true,
  status: true,
  path: true,
  type: false,
  size: false,
  duration: false,
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  fontSizeMode: 'normal',
  fontSizeCustomPx: 14,
  showToast: true,
  captureColumns: { ...DEFAULT_CAPTURE_COLUMNS },
  captureFilters: {
    excludes: [],
    types: { ...DEFAULT_CAPTURE_TYPES },
    unique: { ...DEFAULT_CAPTURE_UNIQUE },
    ignoreOptions: false,
  },
  captureExport: {
    fields: { ...DEFAULT_CAPTURE_EXPORT.fields },
    format: DEFAULT_CAPTURE_EXPORT.format,
    includeSecrets: DEFAULT_CAPTURE_EXPORT.includeSecrets,
  },
  autoReloadOnStorageSwitch: false,
  hiddenPopupGroupIds: [],
};

export const FONT_SIZE_PX: Record<Exclude<FontSizeMode, 'custom'>, number> = {
  small: 12,
  normal: 14,
  big: 17,
};

export function resolveFontSizePx(prefs: UIPreferences): number {
  if (prefs.fontSizeMode === 'custom') {
    return clampFontSize(prefs.fontSizeCustomPx);
  }
  return FONT_SIZE_PX[prefs.fontSizeMode];
}

export function clampFontSize(px: number): number {
  if (!Number.isFinite(px)) return 14;
  return Math.max(10, Math.min(24, Math.round(px)));
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
