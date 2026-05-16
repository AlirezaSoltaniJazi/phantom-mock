import { describe, expect, it, vi, type Mock } from 'vitest';
import { defaultState, getState, setState, updateState } from '@/background/storage';
import { STORAGE_KEYS } from '@/shared/constants';

const get = chrome.storage.local.get as unknown as Mock;
const set = chrome.storage.local.set as unknown as Mock;

describe('storage', () => {
  it('returns defaultState when storage is empty', async () => {
    get.mockResolvedValue({});
    set.mockResolvedValue(undefined);

    const state = await getState();
    expect(state).toEqual(defaultState());
    expect(set).toHaveBeenCalled();
  });

  it('round-trips a state via setState/getState', async () => {
    const storage: Record<string, unknown> = {};
    set.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(storage, items);
    });
    get.mockImplementation(async (key: string) => ({ [key]: storage[key] }));

    const next = defaultState();
    next.masterEnabled = false;
    await setState(next);
    expect(storage[STORAGE_KEYS.APP_STATE]).toEqual(next);
    const fetched = await getState();
    expect(fetched.masterEnabled).toBe(false);
  });

  it('updateState applies an updater function', async () => {
    const storage: Record<string, unknown> = {
      [STORAGE_KEYS.APP_STATE]: defaultState(),
    };
    set.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(storage, items);
    });
    get.mockImplementation(async (key: string) => ({ [key]: storage[key] }));

    const updater = vi.fn((s) => ({ ...s, masterEnabled: false }));
    const result = await updateState(updater);
    expect(updater).toHaveBeenCalled();
    expect(result.masterEnabled).toBe(false);
  });
});
