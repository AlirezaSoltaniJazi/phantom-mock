import { MESSAGE_TYPES } from '@/shared/constants';
import { isRuntimeMessage, type RuntimeMessage, type StateMutation } from '@/shared/messages';
import { CURRENT_SCHEMA_VERSION, type AppState, type Group, type Rule } from '@/shared/types';
import { defaultState, getState, setState, subscribe, updateState } from './storage';
import { syncDnrRules } from './rules-dnr';
import { clearHits, getHits, recordHit, registerLogPortListener } from './log';

function applyMutation(state: AppState, mutation: StateMutation): AppState {
  switch (mutation.kind) {
    case 'setMasterEnabled':
      return { ...state, masterEnabled: mutation.enabled };
    case 'upsertGroup': {
      const groups = upsertById(state.groups, mutation.group);
      return { ...state, groups };
    }
    case 'deleteGroup': {
      if (mutation.groupId === 'default') return state;
      const groups = state.groups.filter((g) => g.id !== mutation.groupId);
      const rules = state.rules.map((r) =>
        r.groupId === mutation.groupId ? { ...r, groupId: 'default' } : r
      );
      return { ...state, groups, rules };
    }
    case 'toggleGroup': {
      const groups = state.groups.map((g) =>
        g.id === mutation.groupId ? { ...g, enabled: mutation.enabled } : g
      );
      return { ...state, groups };
    }
    case 'upsertRule': {
      const rules = upsertById(state.rules, mutation.rule);
      return { ...state, rules };
    }
    case 'deleteRule': {
      const rules = state.rules.filter((r) => r.id !== mutation.ruleId);
      return { ...state, rules };
    }
    case 'toggleRule': {
      const rules = state.rules.map((r) =>
        r.id === mutation.ruleId ? { ...r, enabled: mutation.enabled } : r
      );
      return { ...state, rules };
    }
    case 'replaceState':
      return { ...mutation.state, schemaVersion: CURRENT_SCHEMA_VERSION };
  }
}

function upsertById<T extends Rule | Group>(items: T[], next: T): T[] {
  const idx = items.findIndex((i) => i.id === next.id);
  if (idx === -1) return [...items, next];
  const copy = items.slice();
  copy[idx] = next;
  return copy;
}

async function broadcastRulesUpdated(state: AppState): Promise<void> {
  const message: RuntimeMessage = { type: MESSAGE_TYPES.RULES_UPDATED, state };
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map((tab) => {
        if (typeof tab.id !== 'number') return Promise.resolve();
        return chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
      })
    );
  } catch {
    // chrome.tabs may be unavailable in certain contexts; ignore.
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await getState().catch(() => null);
  if (!current) {
    await setState(defaultState());
  }
  await syncDnrRules(await getState()).catch(() => undefined);
});

chrome.runtime.onStartup.addListener(async () => {
  await syncDnrRules(await getState()).catch(() => undefined);
});

subscribe(async (next) => {
  await syncDnrRules(next).catch(() => undefined);
  await broadcastRulesUpdated(next);
});

registerLogPortListener();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) return false;

  switch (message.type) {
    case MESSAGE_TYPES.GET_STATE:
      getState()
        .then((state) => sendResponse({ ok: true, state }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.MUTATE_STATE:
      updateState((current) => applyMutation(current, message.mutation))
        .then((state) => sendResponse({ ok: true, state }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.MOCK_HIT:
      recordHit(message.hit);
      sendResponse({ ok: true });
      return false;

    case MESSAGE_TYPES.GET_HIT_LOG:
      sendResponse({ ok: true, hits: getHits() });
      return false;

    case MESSAGE_TYPES.CLEAR_HIT_LOG:
      clearHits();
      sendResponse({ ok: true });
      return false;

    default:
      return false;
  }
});
