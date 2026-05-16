import { STORAGE_KEYS } from './constants';
import {
  DEFAULT_UI_PREFERENCES,
  clampFontSize,
  type UIPreferences,
  type FontSizeMode,
} from './types';

const FONT_SIZE_MODES: ReadonlySet<FontSizeMode> = new Set(['small', 'normal', 'big', 'custom']);

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
  return { fontSizeMode, fontSizeCustomPx, showToast };
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
