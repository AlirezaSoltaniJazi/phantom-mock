import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { getPrefs } from '@/shared/prefs';
import { DEFAULT_UI_PREFERENCES } from '@/shared/types';
import { STORAGE_KEYS } from '@/shared/constants';

const storageGet = chrome.storage.local.get as unknown as Mock;

function mockStored(raw: unknown): void {
  storageGet.mockResolvedValue({ [STORAGE_KEYS.UI_PREFS]: raw });
}

describe('getPrefs — hiddenPopupGroupIds sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the full defaults (incl. empty hidden list) when nothing is stored', async () => {
    mockStored(undefined);
    const prefs = await getPrefs();
    expect(prefs).toEqual(DEFAULT_UI_PREFERENCES);
    expect(prefs.hiddenPopupGroupIds).toEqual([]);
  });

  it('defaults to an empty array when stored prefs lack the field', async () => {
    mockStored({ fontSizeMode: 'normal', showToast: false });
    const prefs = await getPrefs();
    expect(prefs.hiddenPopupGroupIds).toEqual([]);
    // unrelated fields still sanitize as before
    expect(prefs.showToast).toBe(false);
  });

  it('passes through a valid array of group ids', async () => {
    mockStored({ hiddenPopupGroupIds: ['grp_a', 'grp_b'] });
    const prefs = await getPrefs();
    expect(prefs.hiddenPopupGroupIds).toEqual(['grp_a', 'grp_b']);
  });

  it('drops non-string entries from corrupt/legacy data', async () => {
    mockStored({ hiddenPopupGroupIds: ['grp_a', 42, null, 'grp_b', { x: 1 }] });
    const prefs = await getPrefs();
    expect(prefs.hiddenPopupGroupIds).toEqual(['grp_a', 'grp_b']);
  });

  it('falls back to the default when the field is not an array', async () => {
    mockStored({ hiddenPopupGroupIds: 'grp_a' });
    const prefs = await getPrefs();
    expect(prefs.hiddenPopupGroupIds).toEqual([]);
  });
});
