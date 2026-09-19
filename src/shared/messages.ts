import { MESSAGE_TYPES } from './constants';
import type { AppState, MockHit } from './types';

export type StateMutation =
  | { kind: 'upsertGroup'; group: import('./types').Group }
  | { kind: 'deleteGroup'; groupId: string }
  | { kind: 'toggleGroup'; groupId: string; enabled: boolean }
  | { kind: 'reorderGroups'; orderedIds: string[] }
  | { kind: 'upsertRule'; rule: import('./types').Rule }
  | { kind: 'deleteRule'; ruleId: string }
  | { kind: 'toggleRule'; ruleId: string; enabled: boolean }
  | { kind: 'upsertStorageProfile'; profile: import('./types').StorageProfile }
  | { kind: 'deleteStorageProfile'; profileId: string }
  | { kind: 'toggleStorageProfile'; profileId: string; enabled: boolean }
  | { kind: 'upsertCookieProfile'; profile: import('./types').CookieProfile }
  | { kind: 'deleteCookieProfile'; profileId: string }
  | { kind: 'toggleCookieProfile'; profileId: string; enabled: boolean }
  | { kind: 'setMasterEnabled'; enabled: boolean }
  | { kind: 'replaceState'; state: AppState };

export interface DnrTestRequest {
  url: string;
  method: string;
  type: chrome.declarativeNetRequest.ResourceType;
}

export type RuntimeMessage =
  | { type: typeof MESSAGE_TYPES.GET_STATE }
  | { type: typeof MESSAGE_TYPES.MUTATE_STATE; mutation: StateMutation }
  | { type: typeof MESSAGE_TYPES.RULES_UPDATED; state: AppState }
  | { type: typeof MESSAGE_TYPES.MOCK_HIT; hit: MockHit }
  | { type: typeof MESSAGE_TYPES.GET_HIT_LOG }
  | { type: typeof MESSAGE_TYPES.CLEAR_HIT_LOG }
  | { type: typeof MESSAGE_TYPES.GET_DNR_DEBUG }
  | { type: typeof MESSAGE_TYPES.TEST_DNR_MATCH; request: DnrTestRequest }
  | { type: typeof MESSAGE_TYPES.CLEAR_DNR_MATCH_LOG }
  | { type: typeof MESSAGE_TYPES.COOKIES_GET; tabId: number; name: string; path?: string }
  | {
      type: typeof MESSAGE_TYPES.COOKIES_SET;
      tabId: number;
      name: string;
      value: string;
      path?: string;
    }
  | { type: typeof MESSAGE_TYPES.COOKIES_REMOVE; tabId: number; name: string; path?: string };

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    typeof type === 'string' &&
    Object.values(MESSAGE_TYPES).includes(type as RuntimeMessage['type'])
  );
}

export async function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response as T);
    });
  });
}

// Once the extension is reloaded, updated, or disabled, any script that was
// already running (an orphaned content script, or a DevTools panel left open
// across the reload) has `chrome.runtime.id` become undefined, and any
// `chrome.*` call throws "Extension context invalidated" — SYNCHRONOUSLY, so
// a trailing `.catch()` can't swallow it. Check this before any runtime call.
export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

// Opens a long-lived port, returning `null` instead of throwing if the
// extension context has been invalidated (or is invalidated mid-call).
export function connectPort(name: string): chrome.runtime.Port | null {
  if (!isExtensionContextValid()) return null;
  try {
    return chrome.runtime.connect({ name });
  } catch {
    return null;
  }
}

// Disconnects a port without throwing if the extension context has since
// been invalidated.
export function disconnectPort(port: chrome.runtime.Port): void {
  try {
    port.disconnect();
  } catch {
    // Context invalidated since connect — nothing to clean up.
  }
}
