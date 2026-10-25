import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  connectPort,
  disconnectPort,
  isExtensionContextValid,
  sanitizeMockHit,
} from '@/shared/messages';

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

describe('sanitizeMockHit', () => {
  const hit = {
    ruleId: 'rule_1',
    ruleName: 'Users',
    url: 'https://api.example.com/users',
    method: 'GET',
    statusCode: 200,
    delayMs: 0,
    ts: 1,
  };

  it('accepts a well-formed hit and drops unknown fields', () => {
    expect(sanitizeMockHit({ ...hit, extra: { evil: true } })).toEqual(hit);
  });

  it('rejects non-objects and wrongly typed fields', () => {
    expect(sanitizeMockHit(null)).toBeNull();
    expect(sanitizeMockHit('hit')).toBeNull();
    expect(sanitizeMockHit({ ...hit, ruleName: { x: 1 } })).toBeNull();
    expect(sanitizeMockHit({ ...hit, statusCode: Number.NaN })).toBeNull();
    expect(sanitizeMockHit({ ...hit, ts: undefined })).toBeNull();
  });

  it('caps oversized strings', () => {
    const out = sanitizeMockHit({ ...hit, url: 'x'.repeat(100_000) });
    expect(out?.url.length).toBe(4096);
  });
});
