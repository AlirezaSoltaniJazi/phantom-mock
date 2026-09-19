import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { connectPort, disconnectPort, isExtensionContextValid } from '@/shared/messages';

const runtime = chrome.runtime as unknown as { id?: string | undefined; connect: Mock };

describe('isExtensionContextValid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false when chrome.runtime.id is undefined (context invalidated)', () => {
    runtime.id = undefined;
    expect(isExtensionContextValid()).toBe(false);
  });

  it('is true when chrome.runtime.id is present', () => {
    runtime.id = 'abc123';
    expect(isExtensionContextValid()).toBe(true);
  });
});

describe('connectPort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.id = 'abc123';
  });

  it('returns null without calling connect when the context is invalidated', () => {
    runtime.id = undefined;
    const port = connectPort('phantom-mock.hit-log');
    expect(port).toBeNull();
    expect(runtime.connect).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when connect throws synchronously', () => {
    runtime.connect.mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    expect(connectPort('phantom-mock.hit-log')).toBeNull();
  });

  it('returns the port when the context is valid', () => {
    const fakePort = { onMessage: { addListener: vi.fn() }, disconnect: vi.fn() };
    runtime.connect.mockReturnValue(fakePort);
    expect(connectPort('phantom-mock.hit-log')).toBe(fakePort);
    expect(runtime.connect).toHaveBeenCalledWith({ name: 'phantom-mock.hit-log' });
  });
});

describe('disconnectPort', () => {
  it('does not throw when port.disconnect() throws (context invalidated since connect)', () => {
    const port = {
      disconnect: vi.fn(() => {
        throw new Error('Extension context invalidated.');
      }),
    } as unknown as chrome.runtime.Port;
    expect(() => disconnectPort(port)).not.toThrow();
  });

  it('calls disconnect when the context is still valid', () => {
    const disconnect = vi.fn();
    const port = { disconnect } as unknown as chrome.runtime.Port;
    disconnectPort(port);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
