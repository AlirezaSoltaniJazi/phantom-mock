import { MESSAGE_TYPES, PAGE_MESSAGE_SOURCE, PAGE_MESSAGE_TYPES } from '@/shared/constants';
import { isRuntimeMessage } from '@/shared/messages';
import { getPrefs, subscribePrefs } from '@/shared/prefs';
import type { AppState, MockHit, Rule, UIPreferences } from '@/shared/types';
import { DEFAULT_UI_PREFERENCES } from '@/shared/types';
import { showGroupActivatedToast, showRuleAppliedToast } from './toast';
import { conditionalGroupForHit } from './group-notify';

// The page-world script that does the actual fetch/XHR patching is registered
// as a second content_scripts entry with `world: "MAIN"` in manifest.json.
// This file runs in the isolated world and only bridges messages between the
// page and the service worker.

// Full latest state, kept so HIT handling can map a hit's rule → its group and
// detect whether that group was activated by a page-URL condition.
let latestState: AppState | null = null;

// Per-page dedup so a conditional group's "group active" toast shows only once
// per page URL, not on every mocked request. Resets when the URL changes (incl.
// SPA client-side navigation, since the next hit re-reads location.href).
let notifyUrl = '';
const notifiedGroupIds = new Set<string>();

function maybeNotifyConditionalGroup(hit: MockHit): void {
  if (!latestState) return;
  const currentUrl = window.location.href;
  if (currentUrl !== notifyUrl) {
    notifyUrl = currentUrl;
    notifiedGroupIds.clear();
  }
  const group = conditionalGroupForHit(latestState, hit.ruleId);
  if (!group || notifiedGroupIds.has(group.id)) return;
  notifiedGroupIds.add(group.id);
  showGroupActivatedToast(group.name);
}

function postRulesToPage(state: AppState): void {
  latestState = state;
  const mockRules = state.rules.filter((r): r is Rule => r.action.kind === 'mock');
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
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.MOCK_HIT, hit }).catch(() => {
      // service worker may have torn down; nothing actionable here
    });
    if (cachedPrefs.showToast) {
      try {
        maybeNotifyConditionalGroup(hit);
        showRuleAppliedToast(hit.ruleName);
      } catch (err) {
        console.warn('[phantom-mock] toast failed', err);
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isRuntimeMessage(message)) return undefined;
  if (message.type === MESSAGE_TYPES.RULES_UPDATED) {
    postRulesToPage(message.state);
  }
  return undefined;
});

void pullStateAndSeed();
