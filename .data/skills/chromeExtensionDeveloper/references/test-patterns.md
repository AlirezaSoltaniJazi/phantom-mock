# Test Patterns — phantom-mock

> Vitest setup, Chrome API mocking, DOM testing, and E2E patterns.

---

## Test Setup

```typescript
// tests/setup.ts

import { vi } from 'vitest';

// Mock chrome.* APIs globally
const chromeMock = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    lastError: null as chrome.runtime.LastError | null,
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  declarativeNetRequest: {
    getDynamicRules: vi.fn().mockResolvedValue([]),
    updateDynamicRules: vi.fn().mockResolvedValue(undefined),
    MAX_NUMBER_OF_DYNAMIC_RULES: 5000,
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  contextMenus: {
    create: vi.fn(),
    remove: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
};

// Assign to global
Object.assign(globalThis, { chrome: chromeMock });

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  chromeMock.runtime.lastError = null;
});
```

---

## Vitest Configuration

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.html'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

---

## Unit Test Examples

### Testing Storage Helpers

```typescript
// tests/background/storage.test.ts

import { describe, it, expect, vi } from 'vitest';
import { getRules, setRules, getState } from '@/background/storage';
import { STORAGE_KEYS } from '@/shared/constants';

describe('storage helpers', () => {
  describe('getRules', () => {
    it('returns empty array when no rules stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const rules = await getRules();

      expect(rules).toEqual([]);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(STORAGE_KEYS.RULES);
    });

    it('returns stored rules', async () => {
      const mockRules = [{ id: 1, url: 'example.com', enabled: true }];
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.RULES]: mockRules,
      });

      const rules = await getRules();

      expect(rules).toEqual(mockRules);
    });
  });

  describe('setRules', () => {
    it('persists rules to storage', async () => {
      const rules = [{ id: 1, url: 'example.com', enabled: true }];

      await setRules(rules);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.RULES]: rules,
      });
    });
  });
});
```

### Testing Message Handlers

```typescript
// tests/background/message-handler.test.ts

import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '@/background/message-handler';
import { MESSAGE_TYPES } from '@/shared/messages';

describe('handleMessage', () => {
  it('handles ADD_RULE message', async () => {
    const mockRule = { url: 'api.example.com', action: 'redirect' };

    const result = await handleMessage({
      type: MESSAGE_TYPES.ADD_RULE,
      payload: { rule: mockRule },
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ url: 'api.example.com' });
  });

  it('rejects unknown message types', async () => {
    const result = await handleMessage({
      type: 'UNKNOWN_TYPE' as any,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unhandled message');
  });
});
```

### Testing DeclarativeNetRequest Rule Sync

```typescript
// tests/background/rules.test.ts

import { describe, it, expect } from 'vitest';
import { syncDeclarativeNetRequestRules } from '@/background/rules';

describe('syncDeclarativeNetRequestRules', () => {
  it('removes old rules and adds new ones atomically', async () => {
    const existingRules = [{ id: 1 }, { id: 2 }];
    chrome.declarativeNetRequest.getDynamicRules.mockResolvedValue(existingRules);

    const newRules = [
      { id: 3, url: 'example.com', enabled: true, action: 'block' },
    ];

    const result = await syncDeclarativeNetRequestRules(newRules);

    expect(result.success).toBe(true);
    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [1, 2],
      addRules: expect.arrayContaining([
        expect.objectContaining({ id: 3 }),
      ]),
    });
  });

  it('filters disabled rules', async () => {
    chrome.declarativeNetRequest.getDynamicRules.mockResolvedValue([]);

    const rules = [
      { id: 1, enabled: true, url: 'a.com', action: 'block' },
      { id: 2, enabled: false, url: 'b.com', action: 'block' },
    ];

    await syncDeclarativeNetRequestRules(rules);

    const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
    expect(call.addRules).toHaveLength(1);
    expect(call.addRules[0].id).toBe(1);
  });
});
```

---

## Content Script DOM Testing

```typescript
// tests/content/ui.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { injectMockIndicator, removeMockIndicator } from '@/content/ui';

describe('content script UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('injects indicator in shadow DOM', () => {
    injectMockIndicator();

    const host = document.querySelector('phantom-mock-root');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).not.toBeNull(); // closed shadow — test via side effects
  });

  it('removes indicator cleanly', () => {
    injectMockIndicator();
    removeMockIndicator();

    const host = document.querySelector('phantom-mock-root');
    expect(host).toBeNull();
  });
});
```

---

## E2E Testing with Playwright

```typescript
// tests/e2e/extension.spec.ts

import { test, expect, chromium } from '@anthropic-ai/playwright';
import path from 'path';

const extensionPath = path.resolve(__dirname, '../../dist');

test.describe('phantom-mock extension', () => {
  test('popup opens and displays rule list', async () => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Get extension ID
    const [background] = context.serviceWorkers();
    const extensionId = background.url().split('/')[2];

    // Open popup
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Verify popup loaded
    await expect(popup.locator('[data-testid="rule-list"]')).toBeVisible();

    await context.close();
  });
});
```

---

## Test Rules

1. **Mock all chrome.* APIs** — never call real Chrome APIs in unit tests
2. **Reset mocks between tests** — use `beforeEach(() => vi.clearAllMocks())`
3. **Test message schemas** — verify type discriminants and payload shapes
4. **Test error paths** — simulate `chrome.runtime.lastError`, network failures, quota exceeded
5. **Use `happy-dom`** for content script tests — lighter than `jsdom`
6. **E2E for integration** — use Playwright with `--load-extension` for full flows
