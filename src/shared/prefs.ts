import { STORAGE_KEYS } from './constants';
import {
  CAPTURE_COLUMN_ORDER,
  CAPTURE_EXCLUDE_KIND_ORDER,
  CAPTURE_EXPORT_FIELD_ORDER,
  CAPTURE_RESOURCE_TYPE_ORDER,
  DEFAULT_CAPTURE_COLUMNS,
  DEFAULT_CAPTURE_EXPORT,
  DEFAULT_CAPTURE_FILTERS,
  DEFAULT_CAPTURE_TYPES,
  DEFAULT_CAPTURE_UNIQUE,
  DEFAULT_UI_PREFERENCES,
  clampFontSize,
  type CaptureColumn,
  type CaptureExcludeKind,
  type CaptureExcludeRule,
  type CaptureExportField,
  type CaptureExportFormat,
  type CaptureExportOptions,
  type CaptureFilters,
  type CaptureResourceType,
  type CaptureUniqueConfig,
  type UIPreferences,
  type FontSizeMode,
} from './types';

const FONT_SIZE_MODES: ReadonlySet<FontSizeMode> = new Set(['small', 'normal', 'big', 'custom']);

function sanitizeColumns(value: unknown): Record<CaptureColumn, boolean> {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_CAPTURE_COLUMNS };
  }
  const v = value as Partial<Record<CaptureColumn, unknown>>;
  const out = { ...DEFAULT_CAPTURE_COLUMNS };
  let anyTrue = false;
  for (const key of CAPTURE_COLUMN_ORDER) {
    if (typeof v[key] === 'boolean') {
      out[key] = v[key];
    }
    if (out[key]) anyTrue = true;
  }
  // Always force at least the path column on so the row isn't empty.
  if (!anyTrue) out.path = true;
  out.path = out.path || DEFAULT_CAPTURE_COLUMNS.path;
  return out;
}

const EXCLUDE_KINDS: ReadonlySet<CaptureExcludeKind> = new Set(CAPTURE_EXCLUDE_KIND_ORDER);
const EXPORT_FORMATS: ReadonlySet<CaptureExportFormat> = new Set(['files', 'single', 'json']);

function sanitizeCaptureTypes(value: unknown): Record<CaptureResourceType, boolean> {
  const out = { ...DEFAULT_CAPTURE_TYPES };
  if (typeof value !== 'object' || value === null) return out;
  const v = value as Partial<Record<CaptureResourceType, unknown>>;
  for (const key of CAPTURE_RESOURCE_TYPE_ORDER) {
    if (typeof v[key] === 'boolean') out[key] = v[key];
  }
  return out;
}

function sanitizeExcludes(value: unknown): CaptureExcludeRule[] {
  if (!Array.isArray(value)) return [];
  const out: CaptureExcludeRule[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Partial<CaptureExcludeRule>;
    if (typeof r.value !== 'string') continue;
    if (!EXCLUDE_KINDS.has(r.kind as CaptureExcludeKind)) continue;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : `cex_${out.length}_${Date.now().toString(36)}`,
      kind: r.kind as CaptureExcludeKind,
      value: r.value,
      enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    });
  }
  return out;
}

function sanitizeUnique(value: unknown): CaptureUniqueConfig {
  const out = { ...DEFAULT_CAPTURE_UNIQUE };
  if (typeof value !== 'object' || value === null) return out;
  const v = value as Partial<Record<keyof CaptureUniqueConfig, unknown>>;
  for (const key of ['enabled', 'byUrl', 'byMethod', 'byRequestBody', 'byResponseBody'] as const) {
    if (typeof v[key] === 'boolean') out[key] = v[key];
  }
  // A dedupe key made of nothing would collapse every request into one row.
  if (!out.byUrl && !out.byMethod && !out.byRequestBody && !out.byResponseBody) {
    out.byUrl = true;
  }
  return out;
}

function sanitizeCaptureFilters(value: unknown): CaptureFilters {
  if (typeof value !== 'object' || value === null) {
    return {
      excludes: [],
      types: { ...DEFAULT_CAPTURE_FILTERS.types },
      unique: { ...DEFAULT_CAPTURE_FILTERS.unique },
      ignoreOptions: DEFAULT_CAPTURE_FILTERS.ignoreOptions,
    };
  }
  const v = value as Partial<CaptureFilters>;
  return {
    excludes: sanitizeExcludes(v.excludes),
    types: sanitizeCaptureTypes(v.types),
    unique: sanitizeUnique(v.unique),
    ignoreOptions:
      typeof v.ignoreOptions === 'boolean'
        ? v.ignoreOptions
        : DEFAULT_CAPTURE_FILTERS.ignoreOptions,
  };
}

function sanitizeCaptureExport(value: unknown): CaptureExportOptions {
  const fields = { ...DEFAULT_CAPTURE_EXPORT.fields };
  let format: CaptureExportFormat = DEFAULT_CAPTURE_EXPORT.format;
  if (typeof value === 'object' && value !== null) {
    const v = value as Partial<CaptureExportOptions>;
    if (typeof v.fields === 'object' && v.fields !== null) {
      const f = v.fields as Partial<Record<CaptureExportField, unknown>>;
      for (const key of CAPTURE_EXPORT_FIELD_ORDER) {
        if (typeof f[key] === 'boolean') fields[key] = f[key];
      }
    }
    if (EXPORT_FORMATS.has(v.format as CaptureExportFormat)) {
      format = v.format as CaptureExportFormat;
    }
  }
  return { fields, format };
}

function sanitize(value: unknown): UIPreferences {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_UI_PREFERENCES };
  const v = value as Partial<UIPreferences>;
  const fontSizeMode: FontSizeMode = FONT_SIZE_MODES.has(v.fontSizeMode as FontSizeMode)
    ? (v.fontSizeMode as FontSizeMode)
    : DEFAULT_UI_PREFERENCES.fontSizeMode;
  const fontSizeCustomPx =
    typeof v.fontSizeCustomPx === 'number'
      ? clampFontSize(v.fontSizeCustomPx)
      : DEFAULT_UI_PREFERENCES.fontSizeCustomPx;
  const showToast =
    typeof v.showToast === 'boolean' ? v.showToast : DEFAULT_UI_PREFERENCES.showToast;
  const captureColumns = sanitizeColumns(v.captureColumns);
  const captureFilters = sanitizeCaptureFilters(v.captureFilters);
  const captureExport = sanitizeCaptureExport(v.captureExport);
  const autoReloadOnStorageSwitch =
    typeof v.autoReloadOnStorageSwitch === 'boolean'
      ? v.autoReloadOnStorageSwitch
      : DEFAULT_UI_PREFERENCES.autoReloadOnStorageSwitch;
  const hiddenPopupGroupIds = Array.isArray(v.hiddenPopupGroupIds)
    ? v.hiddenPopupGroupIds.filter((x): x is string => typeof x === 'string')
    : [...DEFAULT_UI_PREFERENCES.hiddenPopupGroupIds];
  return {
    fontSizeMode,
    fontSizeCustomPx,
    showToast,
    captureColumns,
    captureFilters,
    captureExport,
    autoReloadOnStorageSwitch,
    hiddenPopupGroupIds,
  };
}

export async function getPrefs(): Promise<UIPreferences> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.UI_PREFS);
  return sanitize(result[STORAGE_KEYS.UI_PREFS]);
}

export async function setPrefs(next: UIPreferences): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.UI_PREFS]: sanitize(next) });
}

export async function updatePrefs(
  updater: (current: UIPreferences) => UIPreferences
): Promise<UIPreferences> {
  const current = await getPrefs();
  const next = sanitize(updater(current));
  await setPrefs(next);
  return next;
}

export function subscribePrefs(listener: (next: UIPreferences) => void): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName
  ): void => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEYS.UI_PREFS];
    if (!change) return;
    listener(sanitize(change.newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
