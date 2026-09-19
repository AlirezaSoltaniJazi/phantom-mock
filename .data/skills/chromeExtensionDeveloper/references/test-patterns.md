# Test Patterns — phantom-mock

> Vitest setup, Chrome API mocking, and DOM testing patterns actually used in this project.

---

## Test Setup

The real global `chrome` mock lives in `tests/setup.ts` and is hand-rolled with `vi.fn()` /
a small `makeEvent()` helper — there is no `jest-chrome` or similar mocking package as a
dependency (`package.json` has neither):

```typescript
// tests/setup.ts (abbreviated — see the real file for the full mock)

import { beforeEach, vi } from 'vitest';

function makeEvent<T extends unknown[]>() {
  const listeners = new Set<(...args: T) => void>();
  return {
    addListener: (fn: (...args: T) => void) => listeners.add(fn),
    removeListener: (fn: (...args: T) => void) => listeners.delete(fn),
    hasListener: (fn: (...args: T) => void) => listeners.has(fn),
    clearListeners: () => listeners.clear(),
    dispatch: (...args: T) => {
      for (const fn of listeners) fn(...args);
    },
  };
}

export function createChromeMock() {
  return {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: makeEvent<[unknown, chrome.runtime.MessageSender, (response?: unknown) => void]>(),
      onInstalled: makeEvent<[chrome.runtime.InstalledDetails]>(),
      onStartup: makeEvent<[]>(),
      onConnect: makeEvent<[chrome.runtime.Port]>(),
      lastError: undefined as { message: string } | undefined,
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      getManifest: vi.fn(() => ({ name: 'Phantom Mock', version: '0.0.0-test' })),
    },
    storage: {
      local: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
      onChanged:
        makeEvent<[{ [key: string]: chrome.storage.StorageChange }, chrome.storage.AreaName]>(),
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com/' }),
    },
    cookies: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(null),
      remove: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
    },
    declarativeNetRequest: {
      updateDynamicRules: vi.fn().mockResolvedValue(undefined),
      getDynamicRules: vi.fn().mockResolvedValue([]),
      HeaderOperation: { SET: 'set', APPEND: 'append', REMOVE: 'remove' },
      RequestMethod: { GET: 'get', POST: 'post' /* ... */ },
      ResourceType: { MAIN_FRAME: 'main_frame', SCRIPT: 'script' /* ... */ },
      RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
    },
    devtools: {
      panels: { create: vi.fn() },
      inspectedWindow: { eval: vi.fn(), reload: vi.fn(), tabId: 1 },
      network: {
        onRequestFinished: makeEvent<[chrome.devtools.network.Request]>(),
        getHAR: vi.fn(),
      },
    },
    scripting: { executeScript: vi.fn().mockResolvedValue([]) },
  };
}

const chromeMock = createChromeMock();
(globalThis as unknown as { chrome: unknown }).chrome = chromeMock;

beforeEach(() => {
  vi.clearAllMocks();
  chromeMock.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);
  chromeMock.declarativeNetRequest.getDynamicRules.mockResolvedValue([]);
});
```

There are no `chrome.alarms` or `chrome.contextMenus` entries in this mock — the project doesn't use either API, so don't add mocks for them unless a new feature actually needs them.

---

## Vitest Configuration

```typescript
// vitest.config.ts (actual, root of the repo)

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/**/*.test.mjs'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.html'],
    },
  },
});
```

Run with `npm test` (`vitest run`) or `npm run test:coverage` (`vitest run --coverage`).

---

## Unit Test Examples

### Testing Storage Helpers

```typescript
// tests/background/storage.test.ts (actual pattern)

import { describe, expect, it, vi, type Mock } from 'vitest';
import { defaultState, getState, setState, updateState } from '@/background/storage';
import { STORAGE_KEYS } from '@/shared/constants';

const get = chrome.storage.local.get as unknown as Mock;
const set = chrome.storage.local.set as unknown as Mock;

describe('storage', () => {
  it('returns defaultState when storage is empty', async () => {
    get.mockResolvedValue({});
    set.mockResolvedValue(undefined);

    const state = await getState();
    expect(state).toEqual(defaultState());
    expect(set).toHaveBeenCalled();
  });

  it('round-trips a state via setState/getState', async () => {
    const storage: Record<string, unknown> = {};
    set.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(storage, items);
    });
    get.mockImplementation(async (key: string) => ({ [key]: storage[key] }));

    const next = defaultState();
    next.masterEnabled = false;
    await setState(next);
    expect(storage[STORAGE_KEYS.APP_STATE]).toEqual(next);
    expect((await getState()).masterEnabled).toBe(false);
  });

  it('updateState applies an updater function', async () => {
    const storage: Record<string, unknown> = { [STORAGE_KEYS.APP_STATE]: defaultState() };
    set.mockImplementation(async (items: Record<string, unknown>) => Object.assign(storage, items));
    get.mockImplementation(async (key: string) => ({ [key]: storage[key] }));

    const result = await updateState((s) => ({ ...s, masterEnabled: false }));
    expect(result.masterEnabled).toBe(false);
  });
});
```

There is no `getRules()`/`setRules()` pair and no `STORAGE_KEYS.RULES` — rules live inside the single `AppState` object under `STORAGE_KEYS.APP_STATE`.

### Testing Sender/Permission Guards

```typescript
// tests/background/sender-guards.test.ts (actual pattern)

import { describe, expect, it } from 'vitest';
import { isPrivilegedSender, tabIdMatchesSender } from '@/background/service-worker';

function contentScriptSender(tabId: number): chrome.runtime.MessageSender {
  return {
    id: 'test',
    url: 'https://example.com/page',
    tab: { id: tabId } as chrome.tabs.Tab,
  } as chrome.runtime.MessageSender;
}

describe('tabIdMatchesSender', () => {
  it("rejects a content script trying to spoof a different tab's id", () => {
    expect(tabIdMatchesSender(contentScriptSender(42), 99)).toBe(false);
  });
});
```

Sender trust is verified with `isPrivilegedSender()` (checks `sender.url`/`sender.origin` against `chrome.runtime.getURL('')`) and `tabIdMatchesSender()` — not a `sender.id === chrome.runtime.id` check.

### Testing DeclarativeNetRequest Translation

```typescript
// tests/background/rules-dnr.test.ts (actual pattern)

import { describe, expect, it } from 'vitest';
import { translateToDnrRules } from '@/background/rules-dnr';
import { CURRENT_SCHEMA_VERSION, type AppState, type Rule } from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';

function makeHeaderRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule_h',
    name: 'Header rule',
    groupId: DEFAULT_GROUP_ID,
    enabled: true,
    match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/api/' },
    action: {
      kind: 'header',
      requestHeaders: [{ name: 'X-Phantom', op: 'set', value: 'yes' }],
      responseHeaders: [{ name: 'X-Trace', op: 'remove' }],
    },
    ...overrides,
  };
}

function makeState(rules: Rule[], masterEnabled = true): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled,
    groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
    rules,
    storageProfiles: [],
    cookieProfiles: [],
  };
}

describe('translateToDnrRules', () => {
  it('returns empty when master is off', () => {
    expect(translateToDnrRules(makeState([makeHeaderRule()], false))).toEqual([]);
  });
});
```

Note the real names: `translateToDnrRules()` / `syncDnrRules()` / `ruleIdFor()` in `@/background/rules-dnr` — not `syncDeclarativeNetRequestRules()` in a `@/background/rules` module (neither exists).

### Testing Content-Script Guards

```typescript
// tests/content/runtime.test.ts (actual pattern)

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { isExtensionContextValid, sendRuntimeMessage } from '@/content/runtime';
import { MESSAGE_TYPES } from '@/shared/constants';

const runtime = chrome.runtime as unknown as { id?: string | undefined; sendMessage: Mock };

describe('isExtensionContextValid', () => {
  it('is false when chrome.runtime.id is undefined (orphaned content script)', () => {
    runtime.id = undefined;
    expect(isExtensionContextValid()).toBe(false);
  });
});
```

---

## Toast / Shadow-DOM Testing

There is no `@/content/ui` module or `injectMockIndicator()`/`removeMockIndicator()` pair in
this project. Injected UI lives in `content/toast.ts`, which exposes
`showRuleAppliedToast(ruleName, groupName?)` and `showGroupActivatedToast(groupName)` and builds
a closed shadow root under a `<div id="phantom-mock-toast-host">`. A test for it would look like:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { showRuleAppliedToast } from '@/content/toast';

describe('toast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.querySelector('#phantom-mock-toast-host')?.remove();
  });

  it('creates a closed-shadow host on first toast', () => {
    showRuleAppliedToast('My Rule');
    const host = document.getElementById('phantom-mock-toast-host');
    expect(host).not.toBeNull();
    // shadowRoot is closed — assert via behavior, not `host.shadowRoot`
  });
});
```

---

## E2E Testing

There is currently **no E2E/browser-driven test suite in this project** — no Playwright (or
any other browser-automation) dependency in `package.json`, and no `tests/e2e/` directory.
All test coverage is Vitest unit tests under `tests/`, mirroring `src/`. If browser-driven
extension testing is added later, Playwright's `--load-extension` launch flag (with the real
`playwright`/`@playwright/test` package, not any `@anthropic-ai/*` package — that scope doesn't
publish a Playwright package) is the standard approach — but don't write code or docs assuming
it already exists in this repo.

---

## Test Rules

1. _*Mock all chrome.* APIs_* — never call real Chrome APIs in unit tests
2. **Reset mocks between tests** — use `beforeEach(() => vi.clearAllMocks())`
3. **Test message schemas** — verify `isRuntimeMessage()` and the `RuntimeMessage`/`StateMutation` discriminants
4. **Test error paths** — simulate `chrome.runtime.lastError`, rejected promises, malformed stored state
5. **Use `happy-dom`** (configured in `vitest.config.ts`) — this project does not use `jsdom`
6. **No E2E today** — see above; don't reference Playwright as if it's already wired up
