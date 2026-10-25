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

describe('getPrefs — capture filter sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the capture defaults when the field is missing or junk', async () => {
    mockStored({ captureFilters: 'nope' });
    const prefs = await getPrefs();
    expect(prefs.captureFilters).toEqual(DEFAULT_UI_PREFERENCES.captureFilters);
  });

  it('keeps only well-formed exclusions and backfills their ids', async () => {
    mockStored({
      captureFilters: {
        excludes: [
          { id: 'cex_1', kind: 'domain', value: 'ads.com', enabled: false },
          { kind: 'contains', value: 'sockjs' },
          { kind: 'nonsense', value: 'x' },
          { kind: 'domain', value: 42 },
          'garbage',
        ],
      },
    });
    const { excludes } = (await getPrefs()).captureFilters;
    expect(excludes).toHaveLength(2);
    expect(excludes[0]).toEqual({ id: 'cex_1', kind: 'domain', value: 'ads.com', enabled: false });
    expect(excludes[1]).toMatchObject({ kind: 'contains', value: 'sockjs', enabled: true });
    expect(excludes[1]?.id).toBeTruthy();
  });

  it('merges partial resource-type toggles over the defaults', async () => {
    mockStored({ captureFilters: { types: { img: false, bogus: false, font: 'no' } } });
    const { types } = (await getPrefs()).captureFilters;
    expect(types.img).toBe(false);
    expect(types.font).toBe(true);
    expect(types.xhr).toBe(true);
  });

  it('keeps ignoreOptions as a boolean and defaults it off', async () => {
    mockStored({ captureFilters: { ignoreOptions: true } });
    expect((await getPrefs()).captureFilters.ignoreOptions).toBe(true);
    mockStored({ captureFilters: { ignoreOptions: 'yes' } });
    expect((await getPrefs()).captureFilters.ignoreOptions).toBe(false);
  });

  it('forces a usable dedupe key when every part is unticked', async () => {
    mockStored({
      captureFilters: {
        unique: {
          enabled: true,
          byUrl: false,
          byMethod: false,
          byRequestBody: false,
          byResponseBody: false,
        },
      },
    });
    const { unique } = (await getPrefs()).captureFilters;
    expect(unique.enabled).toBe(true);
    expect(unique.byUrl).toBe(true);
  });
});

describe('getPrefs — capture export sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges known fields and rejects an unknown format', async () => {
    mockStored({ captureExport: { fields: { responseBody: false, nope: true }, format: 'pdf' } });
    const { captureExport } = await getPrefs();
    expect(captureExport.fields.responseBody).toBe(false);
    expect(captureExport.fields.curl).toBe(true);
    expect(captureExport).not.toHaveProperty('fields.nope');
    expect(captureExport.format).toBe('files');
  });

  it('accepts each supported format', async () => {
    for (const format of ['files', 'single', 'json'] as const) {
      mockStored({ captureExport: { format } });
      expect((await getPrefs()).captureExport.format).toBe(format);
    }
  });
});
