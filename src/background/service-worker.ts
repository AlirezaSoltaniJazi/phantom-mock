import { MESSAGE_TYPES } from '@/shared/constants';
import { isRuntimeMessage, type RuntimeMessage, type StateMutation } from '@/shared/messages';
import { CURRENT_SCHEMA_VERSION, type AppState, type Group, type Rule } from '@/shared/types';
import { defaultState, getState, setState, subscribe, updateState } from './storage';
import { syncDnrRules, translateToDnrRules } from './rules-dnr';
import { clearHits, getHits, recordHit, registerLogPortListener } from './log';
import {
  clearDnrMatches,
  registerDnrMatchListener,
  registerDnrMatchPortListener,
} from './dnr-match-log';

// Stash the last failure from chrome.declarativeNetRequest.updateDynamicRules
// so the DevTools Debug tab can show it. Cleared on each successful sync.
interface DnrSyncError {
  message: string;
  translatedJson: string;
  ts: number;
}
let lastDnrSyncError: DnrSyncError | null = null;

async function syncDnrWithDiagnostics(state: AppState): Promise<void> {
  console.log(
    `[pm-debug] syncDnr:enter rules=${state.rules.length} headerRules=${state.rules.filter((r) => r.action.kind === 'header').length} master=${state.masterEnabled}`
  );
  try {
    await syncDnrRules(state);
    console.log('[pm-debug] syncDnr:ok');
    lastDnrSyncError = null;
  } catch (err) {
    const translated = translateToDnrRules(state);
    lastDnrSyncError = {
      message: (err as Error).message,
      translatedJson: JSON.stringify(translated, null, 2),
      ts: Date.now(),
    };
    console.warn('[pm-debug] syncDnr:FAIL', (err as Error).message);
    console.error(
      '[phantom-mock] declarativeNetRequest.updateDynamicRules failed',
      err,
      'translated rules:',
      translated
    );
  }
}

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

// Only tabs matching our content_scripts `matches` actually have a listener.
// Sending to chrome://, chrome-extension://, view-source:, the Web Store, or
// tabs still loading at document_start raises "Could not establish connection.
// Receiving end does not exist." in the *target tab's* console before our
// promise .catch() runs. Filter first instead of suppressing after the fact.
function canReceiveContentScriptMessage(tab: chrome.tabs.Tab): tab is chrome.tabs.Tab & {
  id: number;
  url: string;
} {
  if (typeof tab.id !== 'number') return false;
  if (tab.status !== 'complete') return false;
  const url = tab.url;
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
}

async function broadcastRulesUpdated(state: AppState): Promise<void> {
  console.log('[pm-debug] broadcast:enter');
  const message: RuntimeMessage = { type: MESSAGE_TYPES.RULES_UPDATED, state };
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file:///*'] });
    const targets = tabs.filter(canReceiveContentScriptMessage);
    console.log(`[pm-debug] broadcast:done tabs=${targets.length}`);
    await Promise.all(
      targets.map((tab) => chrome.tabs.sendMessage(tab.id, message).catch(() => undefined))
    );
  } catch {
    // chrome.tabs may be unavailable in certain contexts; ignore.
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await getState().catch(() => null);
  console.log(`[pm-debug] onInstalled current=${!!current}`);
  if (!current) {
    await setState(defaultState());
  }
  await syncDnrWithDiagnostics(await getState());
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[pm-debug] onStartup');
  await syncDnrWithDiagnostics(await getState());
});

subscribe(async (next) => {
  console.log(`[pm-debug] subscribe:fire rules=${next.rules.length} master=${next.masterEnabled}`);
  await syncDnrWithDiagnostics(next);
  await broadcastRulesUpdated(next);
});

registerLogPortListener();
registerDnrMatchPortListener();
registerDnrMatchListener();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) return false;

  switch (message.type) {
    case MESSAGE_TYPES.GET_STATE:
      console.log(`[pm-debug] msg:GET_STATE from=${_sender.tab?.id ?? 'ext'}`);
      getState()
        .then((state) => sendResponse({ ok: true, state }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.MUTATE_STATE:
      console.log(`[pm-debug] msg:MUTATE_STATE kind=${message.mutation.kind}`);
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

    case MESSAGE_TYPES.CLEAR_DNR_MATCH_LOG:
      clearDnrMatches();
      sendResponse({ ok: true });
      return false;

    case MESSAGE_TYPES.GET_DNR_DEBUG:
      console.log('[pm-debug] msg:GET_DNR_DEBUG');
      Promise.all([getState(), chrome.declarativeNetRequest.getDynamicRules()])
        .then(([state, registered]) => {
          const translated = translateToDnrRules(state);
          console.log(
            `[pm-debug] dnrDebug registered=${registered.length} translated=${translated.length}`
          );
          sendResponse({
            ok: true,
            registered,
            translated,
            lastSyncError: lastDnrSyncError,
          });
        })
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.TEST_DNR_MATCH: {
      const { url, method, type } = message.request;
      console.log(`[pm-debug] msg:TEST_DNR_MATCH url=${url} method=${method} type=${type}`);
      // chrome.declarativeNetRequest.testMatchOutcome is the canonical
      // "would this URL match any of my rules?" probe.
      const api = chrome.declarativeNetRequest as typeof chrome.declarativeNetRequest & {
        testMatchOutcome?: (
          req: { url: string; method?: string; type?: chrome.declarativeNetRequest.ResourceType },
          cb: (result: { matchedRules: chrome.declarativeNetRequest.MatchedRule[] }) => void
        ) => void;
      };
      if (!api.testMatchOutcome) {
        sendResponse({ ok: false, error: 'testMatchOutcome unavailable in this Chrome build' });
        return false;
      }
      api.testMatchOutcome({ url, method: method.toLowerCase(), type }, (result) => {
        const err = chrome.runtime.lastError;
        console.log(`[pm-debug] testMatch result matched=${result.matchedRules.length}`);
        if (err) sendResponse({ ok: false, error: err.message });
        else sendResponse({ ok: true, matchedRules: result.matchedRules });
      });
      return true;
    }

    default:
      return false;
  }
});
