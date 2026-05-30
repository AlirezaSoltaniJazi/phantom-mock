import { MESSAGE_TYPES } from '@/shared/constants';
import { isRuntimeMessage, type RuntimeMessage, type StateMutation } from '@/shared/messages';
import { CURRENT_SCHEMA_VERSION, type AppState } from '@/shared/types';
import { defaultState, getState, setState, subscribe, updateState } from './storage';
import { syncDnrRules, translateToDnrRules } from './rules-dnr';
import { clearHits, getHits, recordHit, registerLogPortListener } from './log';
import {
  clearDnrMatches,
  registerDnrMatchListener,
  registerDnrMatchPortListener,
} from './dnr-match-log';
import { getCookie, setCookie, removeCookie } from './cookies';

// Stash the last failure from chrome.declarativeNetRequest.updateDynamicRules
// so the DevTools Debug tab can show it. Cleared on each successful sync.
interface DnrSyncError {
  message: string;
  translatedJson: string;
  ts: number;
}
let lastDnrSyncError: DnrSyncError | null = null;

async function syncDnrWithDiagnostics(state: AppState): Promise<void> {
  try {
    await syncDnrRules(state);
    lastDnrSyncError = null;
  } catch (err) {
    const translated = translateToDnrRules(state);
    lastDnrSyncError = {
      message: (err as Error).message,
      translatedJson: JSON.stringify(translated, null, 2),
      ts: Date.now(),
    };
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
    case 'upsertStorageProfile': {
      const storageProfiles = upsertById(state.storageProfiles, mutation.profile);
      return { ...state, storageProfiles };
    }
    case 'deleteStorageProfile': {
      const storageProfiles = state.storageProfiles.filter((p) => p.id !== mutation.profileId);
      return { ...state, storageProfiles };
    }
    case 'toggleStorageProfile': {
      const storageProfiles = state.storageProfiles.map((p) =>
        p.id === mutation.profileId ? { ...p, enabled: mutation.enabled } : p
      );
      return { ...state, storageProfiles };
    }
    case 'upsertCookieProfile': {
      const cookieProfiles = upsertById(state.cookieProfiles, mutation.profile);
      return { ...state, cookieProfiles };
    }
    case 'deleteCookieProfile': {
      const cookieProfiles = state.cookieProfiles.filter((p) => p.id !== mutation.profileId);
      return { ...state, cookieProfiles };
    }
    case 'toggleCookieProfile': {
      const cookieProfiles = state.cookieProfiles.map((p) =>
        p.id === mutation.profileId ? { ...p, enabled: mutation.enabled } : p
      );
      return { ...state, cookieProfiles };
    }
    case 'replaceState':
      return { ...mutation.state, schemaVersion: CURRENT_SCHEMA_VERSION };
  }
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
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
  const message: RuntimeMessage = { type: MESSAGE_TYPES.RULES_UPDATED, state };
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file:///*'] });
    const targets = tabs.filter(canReceiveContentScriptMessage);
    await Promise.all(
      targets.map((tab) => chrome.tabs.sendMessage(tab.id, message).catch(() => undefined))
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
  await syncDnrWithDiagnostics(await getState());
});

chrome.runtime.onStartup.addListener(async () => {
  await syncDnrWithDiagnostics(await getState());
});

subscribe(async (next) => {
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

    case MESSAGE_TYPES.CLEAR_DNR_MATCH_LOG:
      clearDnrMatches();
      sendResponse({ ok: true });
      return false;

    case MESSAGE_TYPES.GET_DNR_DEBUG:
      Promise.all([getState(), chrome.declarativeNetRequest.getDynamicRules()])
        .then(([state, registered]) => {
          const translated = translateToDnrRules(state);
          sendResponse({
            ok: true,
            registered,
            translated,
            lastSyncError: lastDnrSyncError,
          });
        })
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.COOKIES_GET:
      getCookie(message.tabId, message.name, message.path)
        .then((cookie) => sendResponse({ ok: true, cookie }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.COOKIES_SET: {
      // Build the setCookie arg with exact-optional-property semantics: only
      // include `path` when the caller actually provided one.
      const req = {
        tabId: message.tabId,
        name: message.name,
        value: message.value,
        ...(message.path !== undefined ? { path: message.path } : {}),
      };
      setCookie(req)
        .then((cookie) => sendResponse({ ok: true, cookie }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    case MESSAGE_TYPES.COOKIES_REMOVE:
      removeCookie(message.tabId, message.name, message.path)
        .then(() => sendResponse({ ok: true }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.TEST_DNR_MATCH: {
      const { url, method, type } = message.request;
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
        if (err) sendResponse({ ok: false, error: err.message });
        else sendResponse({ ok: true, matchedRules: result.matchedRules });
      });
      return true;
    }

    default:
      return false;
  }
});
