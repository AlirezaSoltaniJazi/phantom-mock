import type { RuntimeMessage } from '@/shared/messages';

// After the extension is reloaded, updated, or disabled, an already-injected
// content script is orphaned: `chrome.runtime.id` becomes undefined and any
// `chrome.*` call throws "Extension context invalidated" — SYNCHRONOUSLY, so a
// trailing `.catch()` can't swallow it. Check this before any runtime call.
export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

// Fire-and-forget message send that never throws and never leaves an unhandled
// rejection, even once the extension context has been invalidated (orphaned
// content script) or the service worker has torn down.
export function sendRuntimeMessage(message: RuntimeMessage): void {
  if (!isExtensionContextValid()) return;
  try {
    const result = chrome.runtime.sendMessage(message);
    void Promise.resolve(result).catch(() => undefined);
  } catch {
    // Context invalidated between the check and the call — ignore.
  }
}
