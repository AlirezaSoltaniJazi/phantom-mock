# Service Worker Patterns — phantom-mock

> Lifecycle management, persistence strategies, state recovery, and event-driven architecture.

---

## Service Worker Lifecycle

The MV3 service worker can terminate at any time. Design for statelessness:

```typescript
// src/background/service-worker.ts

// ✅ Correct — event listeners at top level (registered synchronously)
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  /* ... */
});

// ❌ Wrong — conditional event registration (may miss events after wake)
if (someCondition) {
  chrome.runtime.onMessage.addListener(handler); // DON'T DO THIS
}
```

This project does **not** use `chrome.alarms` or `chrome.contextMenus` — there's no periodic background work and no context-menu integration. State recovery instead happens by re-reading `chrome.storage.local` and re-syncing `declarativeNetRequest` on `onInstalled`/`onStartup` (see below).

---

## State Persistence

Never store state in service worker memory — it will be lost. All persisted state lives in a single `AppState` object under one storage key:

```typescript
// src/background/storage.ts

import { CURRENT_SCHEMA_VERSION, type AppState } from '@/shared/types';
import { STORAGE_KEYS } from '@/shared/constants';
import { defaultAppState } from '@/shared/default-state';

export function defaultState(): AppState {
  return defaultAppState();
}

export async function getState(): Promise<AppState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.APP_STATE);
  const raw = result[STORAGE_KEYS.APP_STATE];
  if (!isAppState(raw)) {
    const initial = defaultState();
    await setState(initial);
    return initial;
  }
  return migrate(raw); // additive-only soft migration, runs on every read
}

export async function setState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.APP_STATE]: state });
}

export async function updateState(updater: (current: AppState) => AppState): Promise<AppState> {
  const current = await getState();
  const next = updater(current);
  await setState(next);
  return next;
}

export function subscribe(listener: (next: AppState) => void): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName
  ): void => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEYS.APP_STATE];
    if (!change) return;
    if (isAppState(change.newValue)) listener(change.newValue);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
```

There's no separate "rules" storage key or `MockRule`/`ExtensionState` type — rules, groups, storage profiles, and cookie profiles are all fields inside the single `AppState` object (`STORAGE_KEYS.APP_STATE`), and mutated exclusively through `StateMutation` objects (see [message-passing-guide.md](message-passing-guide.md)).

---

## Installation & Startup Handlers

```typescript
// src/background/service-worker.ts

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

// Re-sync declarativeNetRequest and broadcast to tabs on every storage change,
// not just at startup — this is the project's actual "reactive" persistence
// pattern rather than versioned migrations gated on install `reason`.
subscribe(async (next) => {
  await syncDnrWithDiagnostics(next);
  await broadcastRulesUpdated(next);
});
```

There is no `chrome.contextMenus.create()` call anywhere in this project, and no badge text/color management (`chrome.action.setBadgeBackgroundColor` etc. are not used) — the popup shows counts by reading `AppState` directly, not via the action badge.

---

## DeclarativeNetRequest Rule Sync

```typescript
// src/background/rules-dnr.ts

export function translateToDnrRules(state: AppState): chrome.declarativeNetRequest.Rule[] {
  if (!state.masterEnabled) return [];
  // ...filters state.rules to action.kind === 'header', builds one DNR
  // modifyHeaders rule per rule via buildCondition()/toDnrHeaders()
}

export async function syncDnrRules(state: AppState): Promise<void> {
  const desired = translateToDnrRules(state);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: desired,
  });
}
```

Note the function names: `syncDnrRules()` and `translateToDnrRules()` in `background/rules-dnr.ts` — not `rules.ts` and not `syncDeclarativeNetRequestRules()`. `syncDnrRules()` throws on failure; the caller (`syncDnrWithDiagnostics()` in `service-worker.ts`) is what catches the error, stashes it for the DevTools Debug tab, and logs it — `syncDnrRules()` itself has no `{ success, error }` return value.

Mock (response-body) rules are **never** translated to DNR — DNR can't synthesize a response body. Only `header`-kind rules go through this path; `mock`-kind rules are matched client-side in `injected/page-mock.ts`.

---

## Error Recovery Pattern

```typescript
// Stash the last declarativeNetRequest failure so the DevTools Debug tab can
// surface it, and re-sync from storage on every subsequent change.
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
    console.error('[phantom-mock] declarativeNetRequest.updateDynamicRules failed', err);
  }
}
```

---

## Rules

1. **Register all event listeners synchronously** at top level — never conditionally
2. **Never store state in variables** — always use `chrome.storage.local` via `getState()`/`setState()`/`updateState()`
3. **Design for termination** — SW can die between any two lines of code
4. **Recover on startup** — re-sync DNR rules from storage on `onStartup` and `onInstalled`, and again on every `subscribe()` callback (storage change)
5. **This project doesn't use alarms or context menus** — don't add `chrome.alarms`/`chrome.contextMenus` code unless a new feature genuinely needs it (and the corresponding permission is added to `manifest.json` first)
6. **Batch storage operations** — minimize reads/writes to reduce wake-ups
