import { MESSAGE_TYPES } from './constants';
import type { AppState, MockHit } from './types';

export type StateMutation =
  | { kind: 'upsertGroup'; group: import('./types').Group }
  | { kind: 'deleteGroup'; groupId: string }
  | { kind: 'toggleGroup'; groupId: string; enabled: boolean }
  | { kind: 'upsertRule'; rule: import('./types').Rule }
  | { kind: 'deleteRule'; ruleId: string }
  | { kind: 'toggleRule'; ruleId: string; enabled: boolean }
  | { kind: 'setMasterEnabled'; enabled: boolean }
  | { kind: 'replaceState'; state: AppState };

export type RuntimeMessage =
  | { type: typeof MESSAGE_TYPES.GET_STATE }
  | { type: typeof MESSAGE_TYPES.MUTATE_STATE; mutation: StateMutation }
  | { type: typeof MESSAGE_TYPES.RULES_UPDATED; state: AppState }
  | { type: typeof MESSAGE_TYPES.MOCK_HIT; hit: MockHit }
  | { type: typeof MESSAGE_TYPES.GET_HIT_LOG }
  | { type: typeof MESSAGE_TYPES.CLEAR_HIT_LOG };

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
