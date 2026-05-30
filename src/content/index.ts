import { MESSAGE_TYPES, PAGE_MESSAGE_SOURCE, PAGE_MESSAGE_TYPES } from '@/shared/constants';
import { isRuntimeMessage } from '@/shared/messages';
import { getPrefs, subscribePrefs } from '@/shared/prefs';
import type { AppState, MockHit, Rule, UIPreferences } from '@/shared/types';
import { DEFAULT_UI_PREFERENCES } from '@/shared/types';
import { showRuleAppliedToast } from './toast';

// The page-world script that does the actual fetch/XHR patching is registered
// as a second content_scripts entry with `world: "MAIN"` in manifest.json.
// This file runs in the isolated world and only bridges messages between the
// page and the service worker.

function postRulesToPage(state: AppState): void {
  const mockRules = state.rules.filter((r): r is Rule => r.action.kind === 'mock');
  console.log(
    `[pm-debug] content:postRules mockRules=${mockRules.length} master=${state.masterEnabled}`
  );
  window.postMessage(
    {
      source: PAGE_MESSAGE_SOURCE,
      type: PAGE_MESSAGE_TYPES.RULES,
      payload: {
        masterEnabled: state.masterEnabled,
        groups: state.groups,
        rules: mockRules,
      },
    },
    '*'
  );
}

async function pullStateAndSeed(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE });
    console.log(`[pm-debug] content:GET_STATE response=${!!response}`);
    if (response && typeof response === 'object' && 'state' in response) {
      postRulesToPage((response as { state: AppState }).state);
    }
  } catch (err) {
    console.warn('[phantom-mock] failed to pull state', err);
  }
}

let cachedPrefs: UIPreferences = DEFAULT_UI_PREFERENCES;
void getPrefs().then((p) => {
  cachedPrefs = p;
});
subscribePrefs((p) => {
  cachedPrefs = p;
});

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as { source?: string; type?: string; payload?: unknown };
  if (!data || data.source !== PAGE_MESSAGE_SOURCE) return;
  if (data.type === PAGE_MESSAGE_TYPES.HIT) {
    const hit = data.payload as MockHit;
    console.log(`[pm-debug] content:send MOCK_HIT rule=${hit.ruleName}`);
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.MOCK_HIT, hit }).catch(() => {
      // service worker may have torn down; nothing actionable here
    });
    if (cachedPrefs.showToast) {
      try {
        showRuleAppliedToast(hit.ruleName);
      } catch (err) {
        console.warn('[phantom-mock] toast failed', err);
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isRuntimeMessage(message)) return undefined;
  console.log(`[pm-debug] content:recv ${message.type}`);
  if (message.type === MESSAGE_TYPES.RULES_UPDATED) {
    postRulesToPage(message.state);
  }
  return undefined;
});

void pullStateAndSeed();
