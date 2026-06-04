import { describe, expect, it } from 'vitest';
import { isPrivilegedSender, tabIdMatchesSender } from '@/background/service-worker';

// Trusted extension contexts (popup, options, DevTools panel) report
// sender.url as chrome-extension://<our-id>/<page>.
function extensionSender(): chrome.runtime.MessageSender {
  return {
    id: 'phantom-mock-test',
    url: 'chrome-extension://test/panel.html',
  } as chrome.runtime.MessageSender;
}

// Content scripts run in tabs on http(s) origins. sender.url is the page's
// URL, and sender.tab is set to the tab the script runs in.
function contentScriptSender(tabId: number): chrome.runtime.MessageSender {
  return {
    id: 'phantom-mock-test',
    url: 'https://example.com/page',
    tab: { id: tabId } as chrome.tabs.Tab,
  } as chrome.runtime.MessageSender;
}

// THE BUG WE'RE GUARDING AGAINST: in Chrome MV3 a DevTools panel sender
// has BOTH a chrome-extension:// URL AND sender.tab populated (the inspected
// tab). Old guard checked `sender.tab === undefined` and wrongly rejected
// this case, breaking Settings → Import.
function devToolsPanelSender(inspectedTabId: number): chrome.runtime.MessageSender {
  return {
    id: 'phantom-mock-test',
    url: 'chrome-extension://test/panel.html',
    tab: { id: inspectedTabId } as chrome.tabs.Tab,
  } as chrome.runtime.MessageSender;
}

describe('isPrivilegedSender', () => {
  it('returns true for an extension-page sender (popup / options)', () => {
    expect(isPrivilegedSender(extensionSender())).toBe(true);
  });

  it('returns true for a DevTools panel sender even when sender.tab is set (regression)', () => {
    // This is the v0.5.0 bug: Settings → Import was rejected because the
    // panel reports the inspected tab id in sender.tab. The URL-prefix check
    // is what makes the panel correctly identified as a trusted context.
    expect(isPrivilegedSender(devToolsPanelSender(42))).toBe(true);
  });

  it('returns false for a content script sender (page-world)', () => {
    expect(isPrivilegedSender(contentScriptSender(42))).toBe(false);
  });

  it('returns false for a sender with neither url nor origin', () => {
    expect(isPrivilegedSender({} as chrome.runtime.MessageSender)).toBe(false);
  });
});

describe('tabIdMatchesSender', () => {
  it('allows any tabId for extension-context senders (popup / options)', () => {
    const sender = extensionSender();
    expect(tabIdMatchesSender(sender, 1)).toBe(true);
    expect(tabIdMatchesSender(sender, 9999)).toBe(true);
  });

  it('allows any tabId for a DevTools panel sender, even though sender.tab is set', () => {
    // The panel picks the right tabId itself via
    // chrome.devtools.inspectedWindow.tabId; we trust whichever number it sends.
    const sender = devToolsPanelSender(42);
    expect(tabIdMatchesSender(sender, 7)).toBe(true);
    expect(tabIdMatchesSender(sender, 42)).toBe(true);
  });

  it('allows a content script to act ONLY on its own tabId', () => {
    expect(tabIdMatchesSender(contentScriptSender(42), 42)).toBe(true);
  });

  it("rejects a content script trying to spoof a different tab's id (cross-tab cookie exfiltration vector)", () => {
    expect(tabIdMatchesSender(contentScriptSender(42), 99)).toBe(false);
  });

  it('rejects a content script whose sender.tab has no id', () => {
    const sender = {
      id: 'phantom-mock-test',
      url: 'https://example.com/page',
      tab: {} as chrome.tabs.Tab,
    } as chrome.runtime.MessageSender;
    expect(tabIdMatchesSender(sender, 42)).toBe(false);
  });
});
