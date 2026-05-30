import { STORAGE_KEYS } from './constants';
import {
  CAPTURE_COLUMN_ORDER,
  DEFAULT_CAPTURE_COLUMNS,
  DEFAULT_UI_PREFERENCES,
  clampFontSize,
  type CaptureColumn,
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
  const autoReloadOnStorageSwitch =
    typeof v.autoReloadOnStorageSwitch === 'boolean'
      ? v.autoReloadOnStorageSwitch
      : DEFAULT_UI_PREFERENCES.autoReloadOnStorageSwitch;
  return {
    fontSizeMode,
    fontSizeCustomPx,
    showToast,
    captureColumns,
    autoReloadOnStorageSwitch,
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
