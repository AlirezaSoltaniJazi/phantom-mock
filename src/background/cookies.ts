// Origin-scoped cookie operations routed through chrome.cookies. The DevTools
// panel doesn't have direct access to chrome.cookies (it's an extension API),
// so all reads/writes flow through the service worker. We always resolve the
// inspected tab's URL first so Chrome can derive domain/secure/sameSite from
// the origin — the panel never passes those fields explicitly.

const SUPPORTED_SCHEMES = ['http:', 'https:', 'file:'] as const;

export async function resolveTabUrl(tabId: number): Promise<URL> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) {
    throw new Error('Tab has no URL');
  }
  const url = new URL(tab.url);
  if (!SUPPORTED_SCHEMES.includes(url.protocol as (typeof SUPPORTED_SCHEMES)[number])) {
    throw new Error(`Unsupported scheme: ${url.protocol}`);
  }
  return url;
}

// chrome.cookies.get / set / remove all key off the URL's pathname when
// matching cookies. A cookie scoped to '/api/admin/' won't be returned by a
// get against 'https://example.com/' because the pathname '/' doesn't fall
// under '/api/admin/'. So when the profile configures a non-root path, we
// rewrite the URL's pathname before each call.
function urlForPath(base: URL, path: string | undefined): string {
  const next = new URL(base.toString());
  next.pathname = path && path.length > 0 ? path : '/';
  return next.toString();
}

export async function getCookie(
  tabId: number,
  name: string,
  path?: string
): Promise<chrome.cookies.Cookie | null> {
  const base = await resolveTabUrl(tabId);
  const cookie = await chrome.cookies.get({ url: urlForPath(base, path), name });
  return cookie ?? null;
}

export async function setCookie(req: {
  tabId: number;
  name: string;
  value: string;
  path?: string;
}): Promise<chrome.cookies.Cookie | null> {
  const base = await resolveTabUrl(req.tabId);
  // Intentionally omit domain/secure/sameSite — Chrome derives them from the
  // tab URL. Default path to '/' when missing so cookies are visible across
  // the origin's pages.
  const cookie = await chrome.cookies.set({
    url: urlForPath(base, req.path),
    name: req.name,
    value: req.value,
    path: req.path && req.path.length > 0 ? req.path : '/',
  });
  return cookie ?? null;
}

export async function removeCookie(tabId: number, name: string, path?: string): Promise<void> {
  const base = await resolveTabUrl(tabId);
  await chrome.cookies.remove({ url: urlForPath(base, path), name });
}
