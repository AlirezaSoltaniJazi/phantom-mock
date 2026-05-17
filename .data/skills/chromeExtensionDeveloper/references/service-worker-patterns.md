# Service Worker Patterns — phantom-mock

> Lifecycle management, persistence strategies, state recovery, and event-driven architecture.

---

## Service Worker Lifecycle

The MV3 service worker can terminate at any time. Design for statelessness:

```typescript
// src/background/index.ts

// ✅ Correct — event listeners at top level (registered synchronously)
chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onStartup.addListener(handleStartup);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener(handleRuleMatched);

// ❌ Wrong — conditional event registration (may miss events after wake)
if (someCondition) {
  chrome.runtime.onMessage.addListener(handler); // DON'T DO THIS
}
```

---

## State Persistence

Never store state in service worker memory — it will be lost:

```typescript
// src/background/storage.ts

import { STORAGE_KEYS } from '@/shared/constants';
import type { MockRule, ExtensionState } from '@/shared/types';

// Typed storage wrapper
export async function getState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STATE);
  return result[STORAGE_KEYS.STATE] ?? getDefaultState();
}

export async function setState(
  updater: (current: ExtensionState) => ExtensionState,
): Promise<void> {
  const current = await getState();
  const next = updater(current);
  await chrome.storage.local.set({ [STORAGE_KEYS.STATE]: next });
}

export async function getRules(): Promise<MockRule[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.RULES);
  return result[STORAGE_KEYS.RULES] ?? [];
}

export async function setRules(rules: MockRule[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
}

function getDefaultState(): ExtensionState {
  return {
    enabled: true,
    ruleCount: 0,
    lastUpdated: Date.now(),
  };
}
```

---

## Installation & Update Handlers

```typescript
// src/background/index.ts

async function handleInstalled(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
  switch (details.reason) {
    case 'install':
      await initializeExtension();
      break;
    case 'update':
      await migrateStorage(details.previousVersion!);
      break;
  }
}

async function initializeExtension(): Promise<void> {
  // Set default state
  await setState(() => getDefaultState());

  // Register context menus
  chrome.contextMenus.create({
    id: 'mock-this-url',
    title: 'Mock this URL with Phantom Mock',
    contexts: ['link', 'page'],
  });

  // Set initial badge
  await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}
```

---

## Persistence via Alarms

Keep service worker alive for time-sensitive operations:

```typescript
// For rule expiration checks
chrome.alarms.create('check-expired-rules', {
  periodInMinutes: 1,
});

async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  switch (alarm.name) {
    case 'check-expired-rules':
      await removeExpiredRules();
      break;
  }
}

async function removeExpiredRules(): Promise<void> {
  const rules = await getRules();
  const now = Date.now();
  const activeRules = rules.filter(
    (rule) => !rule.expiresAt || rule.expiresAt > now,
  );

  if (activeRules.length !== rules.length) {
    await setRules(activeRules);
    await syncDeclarativeNetRequestRules(activeRules);
    await updateBadge(activeRules.length);
  }
}
```

---

## DeclarativeNetRequest Rule Sync

```typescript
// src/background/rules.ts

import type { MockRule } from '@/shared/types';

export async function syncDeclarativeNetRequestRules(
  rules: MockRule[],
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map((r) => r.id);

    // Convert our rules to declarativeNetRequest format
    const addRules = rules
      .filter((r) => r.enabled)
      .map(toDeclarativeNetRequestRule);

    // Atomic update — remove old, add new
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Rule sync failed',
    };
  }
}

function toDeclarativeNetRequestRule(
  rule: MockRule,
): chrome.declarativeNetRequest.Rule {
  return {
    id: rule.id,
    priority: rule.priority ?? 1,
    action: buildAction(rule),
    condition: buildCondition(rule),
  };
}
```

---

## Error Recovery Pattern

```typescript
// Recover state after service worker restart
chrome.runtime.onStartup.addListener(async () => {
  // Re-sync rules from storage to declarativeNetRequest
  const rules = await getRules();
  await syncDeclarativeNetRequestRules(rules);
  await updateBadge(rules.filter((r) => r.enabled).length);
});
```

---

## Rules

1. **Register all event listeners synchronously** at top level — never conditionally
2. **Never store state in variables** — always use `chrome.storage`
3. **Design for termination** — SW can die between any two lines of code
4. **Recover on startup** — re-sync state from storage on `onStartup` and `onInstalled`
5. **Use alarms for periodic work** — never `setInterval` or `setTimeout` for long delays
6. **Batch storage operations** — minimize reads/writes to reduce wake-ups
