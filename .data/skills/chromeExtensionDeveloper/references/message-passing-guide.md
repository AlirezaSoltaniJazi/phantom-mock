# Message Passing Guide — phantom-mock

> Typed message schemas, routing patterns, port lifecycle, and error handling.

---

## Message Type System

All messages use a discriminated union pattern with a `type` field. The discriminant values live in `shared/constants.ts`; the message shapes live in `shared/messages.ts`:

```typescript
// src/shared/constants.ts

export const MESSAGE_TYPES = {
  GET_STATE: 'GET_STATE',
  MUTATE_STATE: 'MUTATE_STATE',
  RULES_UPDATED: 'RULES_UPDATED',
  MOCK_HIT: 'MOCK_HIT',
  GET_HIT_LOG: 'GET_HIT_LOG',
  CLEAR_HIT_LOG: 'CLEAR_HIT_LOG',
  GET_DNR_DEBUG: 'GET_DNR_DEBUG',
  TEST_DNR_MATCH: 'TEST_DNR_MATCH',
  CLEAR_DNR_MATCH_LOG: 'CLEAR_DNR_MATCH_LOG',
  COOKIES_GET: 'COOKIES_GET',
  COOKIES_SET: 'COOKIES_SET',
  COOKIES_REMOVE: 'COOKIES_REMOVE',
} as const;
```

```typescript
// src/shared/messages.ts

import { MESSAGE_TYPES } from './constants';
import type { AppState, MockHit } from './types';

// State mutations are NOT separate message types — they're a single
// `MUTATE_STATE` message carrying a `StateMutation` payload, discriminated by
// a lowerCamelCase `kind` field (not SCREAMING_SNAKE_CASE like message types).
export type StateMutation =
  | { kind: 'upsertGroup'; group: import('./types').Group }
  | { kind: 'deleteGroup'; groupId: string }
  | { kind: 'toggleGroup'; groupId: string; enabled: boolean }
  | { kind: 'reorderGroups'; orderedIds: string[] }
  | { kind: 'upsertRule'; rule: import('./types').Rule }
  | { kind: 'deleteRule'; ruleId: string }
  | { kind: 'toggleRule'; ruleId: string; enabled: boolean }
  | { kind: 'upsertStorageProfile'; profile: import('./types').StorageProfile }
  | { kind: 'deleteStorageProfile'; profileId: string }
  | { kind: 'toggleStorageProfile'; profileId: string; enabled: boolean }
  | { kind: 'upsertCookieProfile'; profile: import('./types').CookieProfile }
  | { kind: 'deleteCookieProfile'; profileId: string }
  | { kind: 'toggleCookieProfile'; profileId: string; enabled: boolean }
  | { kind: 'setMasterEnabled'; enabled: boolean }
  | { kind: 'replaceState'; state: AppState };

export type RuntimeMessage =
  | { type: typeof MESSAGE_TYPES.GET_STATE }
  | { type: typeof MESSAGE_TYPES.MUTATE_STATE; mutation: StateMutation }
  | { type: typeof MESSAGE_TYPES.RULES_UPDATED; state: AppState }
  | { type: typeof MESSAGE_TYPES.MOCK_HIT; hit: MockHit }
  | { type: typeof MESSAGE_TYPES.GET_HIT_LOG }
  | { type: typeof MESSAGE_TYPES.CLEAR_HIT_LOG }
  | { type: typeof MESSAGE_TYPES.GET_DNR_DEBUG };

// ...COOKIES_GET/SET/REMOVE and TEST_DNR_MATCH/CLEAR_DNR_MATCH_LOG omitted
// here for brevity — see the real file for the full union.
// Type guard — validates an unknown value is one of our known message types
export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    typeof type === 'string' &&
    Object.values(MESSAGE_TYPES).includes(type as RuntimeMessage['type'])
  );
}

// Sender helper — no envelope wrapping. Resolves with whatever the receiver's
// sendResponse() passed, or REJECTS on chrome.runtime.lastError. There is no
// `{ success, data, error }` response envelope type — callers `await` this and
// either get the raw response or a thrown/rejected Error.
export async function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response as T);
    });
  });
}
```

---

## Sending Messages (Panel/Popup -> Background)

```typescript
// Usage in devtools/state-hook.ts or popup/main.tsx
import { sendMessage } from '@/shared/messages';
import { MESSAGE_TYPES } from '@/shared/constants';

const response = await sendMessage<{ ok: true; state: AppState } | { ok: false; error: string }>({
  type: MESSAGE_TYPES.GET_STATE,
});

if (response.ok) {
  applyState(response.state);
} else {
  console.warn(response.error);
}
```

The receiver decides the shape of a successful payload per message type (e.g. `{ ok: true, state }` for `GET_STATE`, `{ ok: true, hits }` for `GET_HIT_LOG`) — the only project-wide convention is the `ok: true | false` discriminant, not a fixed `{ success, data, error }` envelope.

---

## Receiving Messages (Background Service Worker)

```typescript
// src/background/service-worker.ts (abbreviated — see the real file for the
// full switch over all twelve MESSAGE_TYPES)

import { isRuntimeMessage } from '@/shared/messages';
import { MESSAGE_TYPES } from '@/shared/constants';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRuntimeMessage(message)) return false;

  switch (message.type) {
    case MESSAGE_TYPES.GET_STATE:
      getState()
        .then((state) => sendResponse({ ok: true, state }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true; // async — keep the channel open

    case MESSAGE_TYPES.MUTATE_STATE:
      // Only extension contexts (panel/popup) may mutate persisted state —
      // a content script sender is rejected here.
      if (!isPrivilegedSender(sender)) {
        sendResponse({ ok: false, error: 'MUTATE_STATE is restricted to extension contexts' });
        return false;
      }
      updateState((current) => applyMutation(current, message.mutation))
        .then((state) => sendResponse({ ok: true, state }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;

    case MESSAGE_TYPES.MOCK_HIT:
      recordHit(message.hit);
      sendResponse({ ok: true });
      return false; // synchronous — no need to keep the channel open

    default:
      return false;
  }
});
```

---

## Content Script <-> Background Communication

```typescript
// src/content/index.ts (actual pattern) — pulling state on load
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

// Background -> Content script (targeted, best-effort — content script may
// not be present on chrome://, the Web Store, or a still-loading tab)
async function broadcastRulesUpdated(state: AppState): Promise<void> {
  const message: RuntimeMessage = { type: MESSAGE_TYPES.RULES_UPDATED, state };
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file:///*'] });
  const targets = tabs.filter(canReceiveContentScriptMessage);
  await Promise.all(
    targets.map((tab) => chrome.tabs.sendMessage(tab.id, message).catch(() => undefined))
  );
}
```

Content scripts receiving `RULES_UPDATED` don't call `sendResponse` at all — the listener in `content/index.ts` returns `undefined` synchronously; it's fire-and-forget in that direction.

---

## Long-Lived Connections (Ports)

Phantom Mock uses ports for the two live-tailing views in the DevTools panel — the Hit Log and the DNR Debug match log — not for general request/response traffic:

```typescript
// src/background/log.ts / dnr-match-log.ts — background side
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAMES.HIT_LOG) return; // or PORT_NAMES.DNR_MATCH_LOG
  subscribers.add(port);
  port.postMessage({ kind: 'snapshot', hits: getHits() });
  port.onDisconnect.addListener(() => subscribers.delete(port));
});

// devtools/components/HitLog.tsx — panel side
const port = chrome.runtime.connect({ name: PORT_NAMES.HIT_LOG });
port.onMessage.addListener((message) => {
  // message is { kind: 'snapshot', hits } | { kind: 'hit', hit } | { kind: 'cleared' }
});
```

`PORT_NAMES` (`'phantom-mock.hit-log'`, `'phantom-mock.dnr-match-log'`) is defined in `shared/constants.ts`.

---

## Rules

1. **Always type messages** — never send untyped objects
2. **Always handle errors** — check `chrome.runtime.lastError` and catch exceptions
3. **Return `true` from `onMessage`** — when handler is async (keeps channel open)
4. **Validate incoming messages** — use `isRuntimeMessage()` before processing
5. **Never assume sender** — verify with `isPrivilegedSender()` / `tabIdMatchesSender()` (both in `background/service-worker.ts`) before trusting a mutation or a tab-scoped cookie request
6. **Handle disconnection** — ports close when the panel closes or the SW terminates
