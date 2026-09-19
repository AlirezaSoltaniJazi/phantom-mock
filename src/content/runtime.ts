import { isExtensionContextValid } from '@/shared/messages';
import type { RuntimeMessage } from '@/shared/messages';

export { isExtensionContextValid };

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
