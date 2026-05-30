import { describe, expect, it } from 'vitest';
import { isPrivilegedSender, tabIdMatchesSender } from '@/background/service-worker';

// We never instantiate the actual sender objects Chrome produces; structural
// match is enough for these guards. The narrow casts below intentionally use
// `as` because Chrome's MessageSender type bundles a long list of optional
// fields we don't care about for the guard semantics.
function extensionSender(): chrome.runtime.MessageSender {
  return { id: 'phantom-mock-test' } as chrome.runtime.MessageSender;
}

function contentScriptSender(tabId: number): chrome.runtime.MessageSender {
  return {
    id: 'phantom-mock-test',
    tab: { id: tabId } as chrome.tabs.Tab,
  } as chrome.runtime.MessageSender;
}

describe('isPrivilegedSender', () => {
  it('returns true when sender.tab is undefined (extension context)', () => {
    expect(isPrivilegedSender(extensionSender())).toBe(true);
  });

  it('returns false when sender.tab is defined (content script)', () => {
    expect(isPrivilegedSender(contentScriptSender(42))).toBe(false);
  });
});

describe('tabIdMatchesSender', () => {
  it('allows any tabId for extension-context senders (DevTools panel)', () => {
    // The DevTools panel knows its own inspected tab id via
    // chrome.devtools.inspectedWindow.tabId — we trust whichever number it sends.
    const sender = extensionSender();
    expect(tabIdMatchesSender(sender, 1)).toBe(true);
    expect(tabIdMatchesSender(sender, 9999)).toBe(true);
  });

  it('allows a content script to act ONLY on its own tabId', () => {
    const sender = contentScriptSender(42);
    expect(tabIdMatchesSender(sender, 42)).toBe(true);
  });

  it("rejects a content script trying to spoof a different tab's id (cross-tab cookie exfiltration vector)", () => {
    const sender = contentScriptSender(42);
    expect(tabIdMatchesSender(sender, 99)).toBe(false);
  });

  it('rejects a content script whose sender.tab has no id', () => {
    const sender = { id: 'x', tab: {} as chrome.tabs.Tab } as chrome.runtime.MessageSender;
    expect(tabIdMatchesSender(sender, 42)).toBe(false);
  });
});
