import { PAGE_MESSAGE_SOURCE, PAGE_MESSAGE_TYPES } from '@/shared/constants';
import { buildActiveView, isRuleActive, specMatches } from '@/shared/matcher';
import type { AppState, Group, MockAction, MockHit, Rule } from '@/shared/types';

type RulesPayload = {
  masterEnabled: boolean;
  groups: Group[];
  rules: Rule[];
};

let cache: RulesPayload = { masterEnabled: false, groups: [], rules: [] };
let verboseLog = false;

function logVerbose(...args: unknown[]): void {
  if (verboseLog) {
    console.log('[phantom-mock]', ...args);
  }
}

export function setRulesCacheForTest(next: RulesPayload): void {
  cache = next;
}

function onWindowMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data as { source?: string; type?: string; payload?: RulesPayload };
  if (!data || data.source !== PAGE_MESSAGE_SOURCE) return;
  if (data.type === PAGE_MESSAGE_TYPES.RULES && data.payload) {
    cache = data.payload;
  }
}

function findMatch(url: string, method: string): Rule | undefined {
  if (!cache.masterEnabled) return undefined;
  const fakeState: AppState = {
    schemaVersion: 1,
    masterEnabled: cache.masterEnabled,
    groups: cache.groups,
    rules: cache.rules,
  };
  const view = buildActiveView(fakeState);
  for (const rule of cache.rules) {
    if (rule.action.kind !== 'mock') continue;
    if (!isRuleActive(rule, view, cache.masterEnabled)) continue;
    if (specMatches(rule.match, url, method)) return rule;
  }
  return undefined;
}

function emitHit(rule: Rule, url: string, method: string): void {
  if (rule.action.kind !== 'mock') return;
  if (!rule.action.logToPanel) return;
  const hit: MockHit = {
    ruleId: rule.id,
    ruleName: rule.name,
    url,
    method,
    statusCode: rule.action.statusCode,
    delayMs: rule.action.delayMs,
    ts: Date.now(),
  };
  window.postMessage(
    { source: PAGE_MESSAGE_SOURCE, type: PAGE_MESSAGE_TYPES.HIT, payload: hit },
    '*'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function headersFromAction(action: MockAction): Headers {
  const headers = new Headers();
  if (action.responseContentType) {
    headers.set('Content-Type', action.responseContentType);
  }
  for (const op of action.responseHeaders) {
    if (op.op === 'remove') {
      headers.delete(op.name);
    } else if (op.value !== undefined) {
      if (op.op === 'append') headers.append(op.name, op.value);
      else headers.set(op.name, op.value);
    }
  }
  return headers;
}

function rawHeaderString(headers: Headers): string {
  const lines: string[] = [];
  headers.forEach((value, name) => {
    lines.push(`${name}: ${value}`);
  });
  return lines.join('\r\n');
}

function patchFetch(): void {
  const original = window.fetch.bind(window);
  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    let url: string;
    let method = 'GET';
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else {
      url = input.url;
      method = input.method || 'GET';
    }
    if (init?.method) method = init.method;

    const match = findMatch(url, method);
    logVerbose('fetch', method, url, 'match=', match ? match.name : 'no');
    if (!match || match.action.kind !== 'mock') {
      return original(input, init);
    }
    const action = match.action;
    if (action.delayMs > 0) await sleep(action.delayMs);
    const response = new Response(action.responseBody, {
      status: action.statusCode,
      headers: headersFromAction(action),
    });
    Object.defineProperty(response, 'url', { value: url });
    emitHit(match, url, method);
    return response;
  };
}

interface PatchedXhrFields {
  _pm_method: string;
  _pm_url: string;
  _pm_match: Rule | undefined;
  _pm_requestHeaders: Headers;
}

type PatchedXhr = XMLHttpRequest & PatchedXhrFields;

function patchXhr(): void {
  const OriginalOpen = XMLHttpRequest.prototype.open;
  const OriginalSend = XMLHttpRequest.prototype.send;
  const OriginalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    const self = this as PatchedXhr;
    self._pm_method = method;
    self._pm_url = typeof url === 'string' ? url : url.toString();
    self._pm_requestHeaders = new Headers();
    self._pm_match = undefined;
    const args =
      async === undefined
        ? ([method, url] as const)
        : ([method, url, async, username ?? null, password ?? null] as const);
    return Reflect.apply(OriginalOpen, this, args);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSet(
    this: XMLHttpRequest,
    name: string,
    value: string
  ): void {
    const self = this as PatchedXhr;
    if (self._pm_requestHeaders) self._pm_requestHeaders.append(name, value);
    return OriginalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    const self = this as PatchedXhr;
    const match = findMatch(self._pm_url, self._pm_method);
    logVerbose('xhr', self._pm_method, self._pm_url, 'match=', match ? match.name : 'no');
    if (!match || match.action.kind !== 'mock') {
      return OriginalSend.call(this, body ?? null);
    }
    const action = match.action;
    const headers = headersFromAction(action);
    const rawHeaders = rawHeaderString(headers);

    Object.defineProperty(self, 'readyState', { configurable: true, get: () => 4 });
    Object.defineProperty(self, 'status', { configurable: true, get: () => action.statusCode });
    Object.defineProperty(self, 'statusText', {
      configurable: true,
      get: () => statusText(action.statusCode),
    });
    Object.defineProperty(self, 'responseText', {
      configurable: true,
      get: () => action.responseBody,
    });
    Object.defineProperty(self, 'response', {
      configurable: true,
      get: () => action.responseBody,
    });
    Object.defineProperty(self, 'responseURL', { configurable: true, get: () => self._pm_url });
    self.getAllResponseHeaders = (): string => rawHeaders;
    self.getResponseHeader = (name: string): string | null =>
      headers.get(name.toLowerCase()) ?? null;

    setTimeout(
      () => {
        try {
          self.dispatchEvent(new Event('readystatechange'));
          self.dispatchEvent(new Event('load'));
          self.dispatchEvent(new Event('loadend'));
          emitHit(match, self._pm_url, self._pm_method);
        } catch (err) {
          console.warn('[phantom-mock] XHR mock dispatch failed', err);
        }
      },
      Math.max(0, action.delayMs)
    );
  };
}

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    418: "I'm a teapot",
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[code] ?? '';
}

let installed = false;
let originalFetchRef: typeof window.fetch | null = null;
let patchedFetchRef: typeof window.fetch | null = null;

export function install(): void {
  if (installed) return;
  installed = true;
  originalFetchRef = window.fetch.bind(window);
  window.addEventListener('message', onWindowMessage);
  patchFetch();
  patchXhr();
  patchedFetchRef = window.fetch;
  exposeDebugApi();

  console.log(
    '%c[phantom-mock]%c installed on %s — run window.__phantomMock to inspect',
    'color:#6040c4;font-weight:bold',
    'color:inherit',
    window.location.href
  );
}

function exposeDebugApi(): void {
  const api = {
    get installed(): boolean {
      return installed;
    },
    get fetchPatched(): boolean {
      return window.fetch === patchedFetchRef && patchedFetchRef !== originalFetchRef;
    },
    get masterEnabled(): boolean {
      return cache.masterEnabled;
    },
    get ruleCount(): number {
      return cache.rules.length;
    },
    rules(): Array<{
      id: string;
      name: string;
      method: string;
      pattern: string;
      enabled: boolean;
    }> {
      return cache.rules.map((r) => ({
        id: r.id,
        name: r.name,
        method: r.match.method,
        pattern: r.match.urlPattern,
        enabled: r.enabled,
      }));
    },
    get verbose(): boolean {
      return verboseLog;
    },
    setVerbose(v: boolean): void {
      verboseLog = Boolean(v);

      console.log(`[phantom-mock] verbose=${verboseLog}`);
    },
    test(url: string, method = 'GET'): { matched: boolean; ruleId?: string; ruleName?: string } {
      const fakeState = {
        schemaVersion: 1 as const,
        masterEnabled: cache.masterEnabled,
        groups: cache.groups,
        rules: cache.rules,
      };
      const view = buildActiveView(fakeState);
      for (const rule of cache.rules) {
        if (rule.action.kind !== 'mock') continue;
        if (!isRuleActive(rule, view, cache.masterEnabled)) continue;
        if (specMatches(rule.match, url, method)) {
          return { matched: true, ruleId: rule.id, ruleName: rule.name };
        }
      }
      return { matched: false };
    },
  };
  try {
    Object.defineProperty(window, '__phantomMock', {
      value: api,
      configurable: true,
      writable: false,
    });
  } catch {
    (window as unknown as { __phantomMock: unknown }).__phantomMock = api;
  }
}

install();
