// Panel-side wrapper for the chrome.cookies round-trip. The DevTools panel
// can't call chrome.cookies directly (it's only available to the service
// worker / extension pages with the `cookies` permission), so we send typed
// runtime messages to the SW and unwrap the response here.
//
// All three helpers require a real DevTools host because they target the
// currently inspected tab. When the panel is opened as a standalone page
// (chrome-extension://…/panel.html), chrome.devtools is undefined and we
// surface a friendly error rather than firing a useless message.

import { MESSAGE_TYPES } from '@/shared/constants';
import { sendMessage } from '@/shared/messages';
import type { RuntimeMessage } from '@/shared/messages';

const NOT_IN_DEVTOOLS_MESSAGE = 'Open this panel from DevTools.';

export function getInspectedTabId(): number | null {
  return chrome.devtools?.inspectedWindow?.tabId ?? null;
}

export function hasCookiesAPI(): boolean {
  return (
    chrome.devtools?.inspectedWindow !== undefined &&
    typeof chrome.devtools.inspectedWindow.tabId === 'number'
  );
}

interface CookieGetResponse {
  ok: boolean;
  error?: string;
  cookie?: chrome.cookies.Cookie | null;
}

interface CookieSetResponse {
  ok: boolean;
  error?: string;
  cookie?: chrome.cookies.Cookie | null;
}

interface CookieRemoveResponse {
  ok: boolean;
  error?: string;
}

export async function getCookieValue(name: string, path?: string): Promise<string | null> {
  if (!hasCookiesAPI()) throw new Error(NOT_IN_DEVTOOLS_MESSAGE);
  const tabId = chrome.devtools.inspectedWindow.tabId;
  const message: RuntimeMessage = {
    type: MESSAGE_TYPES.COOKIES_GET,
    tabId,
    name,
    ...(typeof path === 'string' && path.length > 0 ? { path } : {}),
  };
  const resp = await sendMessage<CookieGetResponse>(message);
  if (resp.ok === false) throw new Error(resp.error || 'COOKIES_GET failed');
  return resp.cookie?.value ?? null;
}

export async function setCookieValue(name: string, value: string, path?: string): Promise<void> {
  if (!hasCookiesAPI()) throw new Error(NOT_IN_DEVTOOLS_MESSAGE);
  const tabId = chrome.devtools.inspectedWindow.tabId;
  const message: RuntimeMessage = {
    type: MESSAGE_TYPES.COOKIES_SET,
    tabId,
    name,
    value,
    ...(typeof path === 'string' && path.length > 0 ? { path } : {}),
  };
  const resp = await sendMessage<CookieSetResponse>(message);
  if (resp.ok === false) throw new Error(resp.error || 'COOKIES_SET failed');
}

export async function removeCookie(name: string, path?: string): Promise<void> {
  if (!hasCookiesAPI()) throw new Error(NOT_IN_DEVTOOLS_MESSAGE);
  const tabId = chrome.devtools.inspectedWindow.tabId;
  const message: RuntimeMessage = {
    type: MESSAGE_TYPES.COOKIES_REMOVE,
    tabId,
    name,
    ...(typeof path === 'string' && path.length > 0 ? { path } : {}),
  };
  const resp = await sendMessage<CookieRemoveResponse>(message);
  if (resp.ok === false) throw new Error(resp.error || 'COOKIES_REMOVE failed');
}
