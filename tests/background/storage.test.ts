import { describe, expect, it, vi, type Mock } from 'vitest';
import { defaultState, getState, setState, updateState } from '@/background/storage';
import { STORAGE_KEYS } from '@/shared/constants';
import type { AppState, Rule } from '@/shared/types';

function makeRule(id: string): Rule {
  return {
    id,
    name: id,
    groupId: 'default',
    enabled: true,
    match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/api' },
    action: {
      kind: 'mock',
      statusCode: 200,
      delayMs: 0,
      responseBody: '{}',
      responseContentType: 'application/json',
      responseHeaders: [],
      logToPanel: false,
    },
  };
}

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

  it('soft-migrates pre-0.4.0 state by defaulting storageProfiles to []', async () => {
    // Pre-feature shape: AppState without `storageProfiles`. Must not be
    // rejected — that would wipe the user's rules and groups.
    const legacy = {
      schemaVersion: 1,
      masterEnabled: true,
      groups: [{ id: 'default', name: 'Default', enabled: true, order: 0 }],
      rules: [
        {
          id: 'rule_x',
          name: 'r',
          groupId: 'default',
          enabled: true,
          match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/api' },
          action: {
            kind: 'mock',
            statusCode: 200,
            delayMs: 0,
            responseBody: '{}',
            responseContentType: 'application/json',
            responseHeaders: [],
            logToPanel: false,
          },
        },
      ],
      // no storageProfiles
    };
    get.mockResolvedValue({ [STORAGE_KEYS.APP_STATE]: legacy });
    const state = await getState();
    expect(state.rules.length).toBe(1);
    expect(state.groups.length).toBe(1);
    expect(state.storageProfiles).toEqual([]);
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

  it("queues concurrent updateState calls so none of them lose another's change", async () => {
    // Regression test: updateState() is a read-modify-write. Without
    // serializing overlapping calls, concurrent deletes (e.g. deleting
    // several rules in quick succession) can all read the same
    // pre-mutation snapshot, and whichever setState() commits last wins
    // wholesale — silently resurrecting whatever an earlier call removed.
    const ruleIds = ['rule_a', 'rule_b', 'rule_c'];
    const storage: Record<string, unknown> = {
      [STORAGE_KEYS.APP_STATE]: { ...defaultState(), rules: ruleIds.map(makeRule) },
    };
    // Mimic real chrome.storage.local latency (an actual async round trip)
    // so overlapping calls genuinely interleave instead of resolving
    // synchronously in call order.
    get.mockImplementation(async (key: string) => {
      await Promise.resolve();
      return { [key]: storage[key] };
    });
    set.mockImplementation(async (items: Record<string, unknown>) => {
      await Promise.resolve();
      Object.assign(storage, items);
    });

    const removeRule =
      (id: string) =>
      (s: AppState): AppState => ({
        ...s,
        rules: s.rules.filter((r) => r.id !== id),
      });

    await Promise.all(ruleIds.map((id) => updateState(removeRule(id))));

    const final = storage[STORAGE_KEYS.APP_STATE] as AppState;
    expect(final.rules).toEqual([]);
  });
});
