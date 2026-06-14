import { MESSAGE_TYPES, PAGE_MESSAGE_SOURCE, PAGE_MESSAGE_TYPES } from '@/shared/constants';
import { isRuntimeMessage } from '@/shared/messages';
import { getPrefs, subscribePrefs } from '@/shared/prefs';
import type { AppState, MockHit, Rule, UIPreferences } from '@/shared/types';
import { DEFAULT_UI_PREFERENCES } from '@/shared/types';
import { showGroupActivatedToast, showRuleAppliedToast } from './toast';
import { groupForRule } from './group-notify';
import { isExtensionContextValid, sendRuntimeMessage } from './runtime';

// The page-world script that does the actual fetch/XHR patching is registered
// as a second content_scripts entry with `world: "MAIN"` in manifest.json.
// This file runs in the isolated world and only bridges messages between the
// page and the service worker.

// Full latest state, kept so HIT handling can map a hit's rule → its group and
// detect whether that group was activated by a page-URL condition.
let latestState: AppState | null = null;

// Surface, for every mocked request, which group it came from. When that group
// was selected by a page-URL condition, also show the distinct "group active"
// toast — on EVERY such hit, so it's always clear the conditional group is live.
function notifyToasts(hit: MockHit): void {
  const group = latestState ? groupForRule(latestState, hit.ruleId) : undefined;
  if (group?.activation?.pageUrlContains) {
    showGroupActivatedToast(group.name);
    showRuleAppliedToast(hit.ruleName);
  } else {
    showRuleAppliedToast(hit.ruleName, group?.name);
  }
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
  if (!isExtensionContextValid()) return;
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
    // Synchronously guarded — an orphaned content script (extension reloaded)
    // keeps receiving page-world HITs; an unguarded send throws "Extension
    // context invalidated" that a `.catch()` cannot swallow.
    sendRuntimeMessage({ type: MESSAGE_TYPES.MOCK_HIT, hit });
    if (cachedPrefs.showToast) {
      try {
        notifyToasts(hit);
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
