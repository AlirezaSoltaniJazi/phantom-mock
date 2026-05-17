import { useEffect, useState } from 'react';
import { DEFAULT_UI_PREFERENCES, resolveFontSizePx, type UIPreferences } from './types';
import { getPrefs, setPrefs, subscribePrefs } from './prefs';

export interface UsePrefsResult {
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
  fontSizePx: number;
}

export function usePrefs(): UsePrefsResult {
  const [prefs, setLocalPrefs] = useState<UIPreferences>(DEFAULT_UI_PREFERENCES);

  useEffect(() => {
    void getPrefs().then(setLocalPrefs);
    return subscribePrefs(setLocalPrefs);
  }, []);

  return {
    prefs,
    setPrefs: async (next) => {
      setLocalPrefs(next);
      await setPrefs(next);
    },
    fontSizePx: resolveFontSizePx(prefs),
  };
}

export function applyFontSizeVar(root: HTMLElement, px: number): void {
  root.style.setProperty('--pm-font-size', `${px}px`);
}
