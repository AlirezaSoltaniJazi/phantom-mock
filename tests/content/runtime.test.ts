import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { isExtensionContextValid, sendRuntimeMessage } from '@/content/runtime';
import { MESSAGE_TYPES } from '@/shared/constants';

const runtime = chrome.runtime as unknown as { id?: string | undefined; sendMessage: Mock };

describe('isExtensionContextValid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false when chrome.runtime.id is undefined (orphaned content script)', () => {
    runtime.id = undefined;
    expect(isExtensionContextValid()).toBe(false);
  });

  it('is true when chrome.runtime.id is present', () => {
    runtime.id = 'abc123';
    expect(isExtensionContextValid()).toBe(true);
  });
});

describe('sendRuntimeMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call sendMessage when the context is invalidated', () => {
    runtime.id = undefined;
    sendRuntimeMessage({ type: MESSAGE_TYPES.GET_STATE });
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('does not throw when sendMessage throws synchronously (context invalidated mid-call)', () => {
    runtime.id = 'abc123';
    runtime.sendMessage.mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    expect(() => sendRuntimeMessage({ type: MESSAGE_TYPES.GET_STATE })).not.toThrow();
  });

  it('swallows an async rejection without surfacing it', async () => {
    runtime.id = 'abc123';
    runtime.sendMessage.mockRejectedValue(new Error('The message port closed'));
    expect(() => sendRuntimeMessage({ type: MESSAGE_TYPES.GET_STATE })).not.toThrow();
    await Promise.resolve();
  });
});
