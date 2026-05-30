export type UrlMatchType = 'exact' | 'contains' | 'regex';

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

export interface Group {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
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
}

export interface ExportBundle {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  exportedAt: string;
  groups: Group[];
  rules: Rule[];
}

export type ImportStrategy = 'replace' | 'merge-by-id' | 'append-as-new';

export type FontSizeMode = 'small' | 'normal' | 'big' | 'custom';

export type CaptureColumn = 'time' | 'method' | 'status' | 'path' | 'size' | 'duration';

export const CAPTURE_COLUMN_ORDER: readonly CaptureColumn[] = [
  'time',
  'method',
  'status',
  'path',
  'size',
  'duration',
];

export const CAPTURE_COLUMN_LABELS: Record<CaptureColumn, string> = {
  time: 'Time',
  method: 'Method',
  status: 'Status',
  path: 'Path',
  size: 'Size',
  duration: 'Duration',
};

export interface UIPreferences {
  fontSizeMode: FontSizeMode;
  fontSizeCustomPx: number;
  showToast: boolean;
  captureColumns: Record<CaptureColumn, boolean>;
}

export const DEFAULT_CAPTURE_COLUMNS: Record<CaptureColumn, boolean> = {
  time: true,
  method: true,
  status: true,
  path: true,
  size: false,
  duration: false,
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  fontSizeMode: 'normal',
  fontSizeCustomPx: 14,
  showToast: true,
  captureColumns: { ...DEFAULT_CAPTURE_COLUMNS },
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
