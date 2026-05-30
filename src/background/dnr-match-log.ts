import { MAX_DNR_MATCH_ENTRIES, PORT_NAMES } from '@/shared/constants';
import type { DnrMatchEntry } from '@/shared/types';
import { getState } from './storage';
import { ruleIdFor } from './rules-dnr';

const buffer: DnrMatchEntry[] = [];
const subscribers = new Set<chrome.runtime.Port>();

export function recordDnrMatch(entry: DnrMatchEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_DNR_MATCH_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_DNR_MATCH_ENTRIES);
  }
  for (const port of subscribers) {
    try {
      port.postMessage({ kind: 'match', entry });
    } catch {
      subscribers.delete(port);
    }
  }
}

export function getDnrMatches(): DnrMatchEntry[] {
  return buffer.slice();
}

export function clearDnrMatches(): void {
  buffer.length = 0;
  for (const port of subscribers) {
    try {
      port.postMessage({ kind: 'cleared' });
    } catch {
      subscribers.delete(port);
    }
  }
}

export function registerDnrMatchPortListener(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAMES.DNR_MATCH_LOG) return;
    subscribers.add(port);
    port.postMessage({ kind: 'snapshot', entries: getDnrMatches() });
    port.onDisconnect.addListener(() => {
      subscribers.delete(port);
    });
  });
}

export function registerDnrMatchListener(): void {
  console.log(
    `[pm-debug] dnrMatchListener:register available=${!!chrome.declarativeNetRequest?.onRuleMatchedDebug}`
  );
  if (!chrome.declarativeNetRequest?.onRuleMatchedDebug) return;
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.log(
      `[pm-debug] dnr:matched ruleId=${info.rule.ruleId} url=${info.request.url} method=${info.request.method} type=${info.request.type}`
    );
    // Stamp the time the event fired, BEFORE awaiting state — otherwise
    // the timestamp drifts to reflect storage-read latency, not match time.
    const ts = Date.now();
    async function handle(): Promise<void> {
      const state = await getState();
      const rule = state.rules.find((r) => ruleIdFor(r) === info.rule.ruleId);
      recordDnrMatch({
        ts,
        dnrRuleId: info.rule.ruleId,
        ruleName: rule?.name ?? null,
        ruleId: rule?.id ?? null,
        url: info.request.url,
        method: info.request.method,
      });
    }
    void handle();
  });
}
