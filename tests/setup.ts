import { beforeEach, vi } from 'vitest';

interface Listener<T extends unknown[]> {
  addListener: (fn: (...args: T) => void) => void;
  removeListener: (fn: (...args: T) => void) => void;
  hasListener: (fn: (...args: T) => void) => boolean;
  clearListeners: () => void;
  dispatch: (...args: T) => void;
}

function makeEvent<T extends unknown[]>(): Listener<T> {
  const listeners = new Set<(...args: T) => void>();
  return {
    addListener: (fn) => {
      listeners.add(fn);
    },
    removeListener: (fn) => {
      listeners.delete(fn);
    },
    hasListener: (fn) => listeners.has(fn),
    clearListeners: () => listeners.clear(),
    dispatch: (...args) => {
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
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
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
      RequestMethod: {
        GET: 'get',
        POST: 'post',
        PUT: 'put',
        PATCH: 'patch',
        DELETE: 'delete',
        HEAD: 'head',
        OPTIONS: 'options',
      },
      ResourceType: { XMLHTTPREQUEST: 'xmlhttprequest' },
      RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
    },
    devtools: {
      panels: {
        create: vi.fn(),
      },
      inspectedWindow: {
        eval: vi.fn(),
        reload: vi.fn(),
        tabId: 1 as number,
      },
      network: {
        onRequestFinished: makeEvent<[chrome.devtools.network.Request]>(),
        getHAR: vi.fn(),
      },
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
    },
  };
}

const chromeMock = createChromeMock();
(globalThis as unknown as { chrome: unknown }).chrome = chromeMock;

beforeEach(() => {
  vi.clearAllMocks();
  chromeMock.storage.local.get.mockReset();
  chromeMock.storage.local.set.mockReset();
  chromeMock.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);
  chromeMock.declarativeNetRequest.getDynamicRules.mockResolvedValue([]);
});
