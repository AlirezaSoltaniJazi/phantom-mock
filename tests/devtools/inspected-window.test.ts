import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLocalStorage,
  hasInspectedWindow,
  NOT_IN_DEVTOOLS_MESSAGE,
  reloadInspectedPage,
  removeLocalStorage,
  setLocalStorage,
} from '@/devtools/inspected-window';

type EvalFn = (
  expression: string,
  cb: (
    result: unknown,
    exceptionInfo: { isError?: boolean; isException?: boolean; value?: string } | undefined
  ) => void
) => void;

function mockEval(impl: EvalFn): void {
  (
    chrome.devtools.inspectedWindow.eval as unknown as { mockImplementation: (fn: EvalFn) => void }
  ).mockImplementation(impl);
}

describe('inspected-window helpers', () => {
  it('getLocalStorage builds a getItem expression with a JSON-quoted key', async () => {
    let received: string | undefined;
    mockEval((expr, cb) => {
      received = expr;
      cb('en_GB', undefined);
    });
    const result = await getLocalStorage('HumaCraftStoreItem__preferredLocale');
    expect(received).toBe('window.localStorage.getItem("HumaCraftStoreItem__preferredLocale")');
    expect(result).toBe('en_GB');
  });

  it('setLocalStorage builds a setItem expression with JSON-quoted key + value', async () => {
    let received: string | undefined;
    mockEval((expr, cb) => {
      received = expr;
      cb(undefined, undefined);
    });
    await setLocalStorage('HumaCraftStoreItem__preferredLocale', 'de_DE');
    expect(received).toBe(
      'void window.localStorage.setItem("HumaCraftStoreItem__preferredLocale", "de_DE")'
    );
  });

  it('escapes embedded quotes and backslashes in keys and values', async () => {
    let received: string | undefined;
    mockEval((expr, cb) => {
      received = expr;
      cb(undefined, undefined);
    });
    await setLocalStorage('with"quote', 'has"quote\\and\\backslash');
    // Should not break out of the string literal.
    expect(received).toBe(
      'void window.localStorage.setItem("with\\"quote", "has\\"quote\\\\and\\\\backslash")'
    );
  });

  it('removeLocalStorage builds a removeItem expression', async () => {
    let received: string | undefined;
    mockEval((expr, cb) => {
      received = expr;
      cb(undefined, undefined);
    });
    await removeLocalStorage('foo');
    expect(received).toBe('void window.localStorage.removeItem("foo")');
  });

  it('rejects when exceptionInfo.isException is true', async () => {
    mockEval((_expr, cb) => {
      cb(undefined, { isException: true, value: 'boom' });
    });
    await expect(getLocalStorage('x')).rejects.toThrow('boom');
  });

  it('rejects when exceptionInfo.isError is true', async () => {
    mockEval((_expr, cb) => {
      cb(undefined, { isError: true, value: 'eval target detached' });
    });
    await expect(getLocalStorage('x')).rejects.toThrow('eval target detached');
  });

  it('reloadInspectedPage forwards to chrome.devtools.inspectedWindow.reload', () => {
    const spy = vi.spyOn(chrome.devtools.inspectedWindow, 'reload');
    reloadInspectedPage();
    expect(spy).toHaveBeenCalledWith({ ignoreCache: false });
  });
});

describe('hasInspectedWindow / standalone-panel mode', () => {
  const originalDevtools = chrome.devtools;

  afterEach(() => {
    // Restore the test's chrome.devtools mock after each case.
    Object.defineProperty(chrome, 'devtools', {
      configurable: true,
      writable: true,
      value: originalDevtools,
    });
  });

  it('hasInspectedWindow returns true when chrome.devtools.inspectedWindow.eval exists', () => {
    expect(hasInspectedWindow()).toBe(true);
  });

  it('hasInspectedWindow returns false when chrome.devtools is undefined', () => {
    Object.defineProperty(chrome, 'devtools', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(hasInspectedWindow()).toBe(false);
  });

  it('helpers reject with a friendly message when devtools is unavailable', async () => {
    Object.defineProperty(chrome, 'devtools', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    await expect(getLocalStorage('foo')).rejects.toThrow(NOT_IN_DEVTOOLS_MESSAGE);
    await expect(setLocalStorage('foo', 'bar')).rejects.toThrow(NOT_IN_DEVTOOLS_MESSAGE);
    await expect(removeLocalStorage('foo')).rejects.toThrow(NOT_IN_DEVTOOLS_MESSAGE);
  });

  it('reloadInspectedPage is a silent no-op when devtools is unavailable', () => {
    Object.defineProperty(chrome, 'devtools', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    // Must not throw.
    expect(() => reloadInspectedPage()).not.toThrow();
  });
});
