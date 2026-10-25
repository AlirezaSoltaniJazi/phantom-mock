import { beforeAll, describe, expect, it, vi, type Mock } from 'vitest';
import { MESSAGE_TYPES, PORT_NAMES, STORAGE_KEYS } from '@/shared/constants';
import { getHits } from '@/background/log';
import { CURRENT_SCHEMA_VERSION, type AppState, type Rule } from '@/shared/types';

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | undefined;

const onMessage = chrome.runtime.onMessage as unknown as {
  dispatch: (...args: Parameters<Listener>) => void;
};
const get = chrome.storage.local.get as unknown as Mock;

const contentScript = {
  id: 'test-extension-id',
  url: 'https://evil.example/page',
  tab: { id: 7 },
} as chrome.runtime.MessageSender;
const panel = {
  id: 'test-extension-id',
  url: 'chrome-extension://test/src/devtools/panel.html',
  tab: { id: 7 },
} as chrome.runtime.MessageSender;

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule_1',
    name: 'Users',
    groupId: 'default',
    enabled: true,
    match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/api' },
    action: {
      kind: 'mock',
      statusCode: 200,
      delayMs: 0,
      responseBody: '{}',
      responseContentType: 'application/json',
      responseHeaders: [],
      logToPanel: true,
    },
    ...overrides,
  };
}

const state: AppState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  masterEnabled: true,
  groups: [{ id: 'default', name: 'Default', enabled: true, order: 0 }],
  rules: [
    makeRule(),
    {
      ...makeRule({ id: 'hdr' }),
      action: {
        kind: 'header',
        requestHeaders: [{ op: 'set', name: 'Authorization', value: 'Bearer secret' }],
        responseHeaders: [],
      },
    },
  ],
  storageProfiles: [],
  cookieProfiles: [],
};

function send(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  return new Promise((resolve) => onMessage.dispatch(message, sender, resolve));
}

describe('service worker message gating', () => {
  beforeAll(async () => {
    await import('@/background/service-worker');
  });

  it('rejects privileged messages from content scripts', async () => {
    for (const type of [
      MESSAGE_TYPES.GET_HIT_LOG,
      MESSAGE_TYPES.CLEAR_HIT_LOG,
      MESSAGE_TYPES.GET_DNR_DEBUG,
      MESSAGE_TYPES.CLEAR_DNR_MATCH_LOG,
    ]) {
      expect(await send({ type }, contentScript)).toMatchObject({ ok: false });
    }
    const cookie = { type: MESSAGE_TYPES.COOKIES_GET, tabId: 7, name: 'sid' };
    expect(await send(cookie, contentScript)).toMatchObject({ ok: false });
  });

  it('gives content scripts only active mock rules', async () => {
    get.mockResolvedValue({ [STORAGE_KEYS.APP_STATE]: state });
    const response = (await send({ type: MESSAGE_TYPES.GET_STATE }, contentScript)) as {
      state: AppState;
    };
    expect(response.state.rules.map((r) => r.id)).toEqual(['rule_1']);
    expect(JSON.stringify(response)).not.toContain('Bearer secret');
  });

  it('gives extension pages the full state', async () => {
    get.mockResolvedValue({ [STORAGE_KEYS.APP_STATE]: state });
    const response = (await send({ type: MESSAGE_TYPES.GET_STATE }, panel)) as {
      state: AppState;
    };
    expect(response.state.rules).toHaveLength(2);
  });

  it('drops malformed hits instead of logging them', async () => {
    const before = getHits().length;
    const forged = { type: MESSAGE_TYPES.MOCK_HIT, hit: { ruleName: { x: 1 }, url: {}, ts: 0 } };
    expect(await send(forged, contentScript)).toMatchObject({ ok: false });
    expect(getHits()).toHaveLength(before);
  });

  it('refuses log ports from non-extension senders', () => {
    const onConnect = chrome.runtime.onConnect as unknown as {
      dispatch: (port: chrome.runtime.Port) => void;
    };
    const port = {
      name: PORT_NAMES.HIT_LOG,
      sender: contentScript,
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: { addListener: vi.fn() },
    } as unknown as chrome.runtime.Port;
    onConnect.dispatch(port);
    expect(port.disconnect).toHaveBeenCalled();
    expect(port.postMessage).not.toHaveBeenCalled();
  });
});
