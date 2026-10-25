// Extension contexts (popup, options, DevTools panel) report sender.url
// starting with chrome-extension://<our-id>/. Content scripts on host pages
// report the page's http(s):// URL. We can't rely on `sender.tab === undefined`
// here because Chrome MV3 populates sender.tab on DevTools panel messages
// (with the INSPECTED tab id) — the panel would otherwise be mis-identified
// as a content script and legitimate state mutations (e.g. Settings → Import)
// would be rejected.
export function isPrivilegedSender(sender: chrome.runtime.MessageSender | undefined): boolean {
  if (!sender) return false;
  const ourPrefix = chrome.runtime.getURL('');
  const url = sender.url ?? sender.origin ?? '';
  return url.startsWith(ourPrefix);
}

// Cross-tab cookie access guard. A compromised page's content script could
// otherwise call chrome.runtime.sendMessage with any tabId and ask us to
// read/write httpOnly auth cookies on a totally unrelated tab.
export function tabIdMatchesSender(
  sender: chrome.runtime.MessageSender,
  requestedTabId: number
): boolean {
  if (isPrivilegedSender(sender)) return true;
  return sender.tab?.id === requestedTabId;
}
