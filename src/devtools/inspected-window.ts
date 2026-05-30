// Helpers for interacting with the inspected page from the DevTools panel.
// Wraps chrome.devtools.inspectedWindow.* (which uses the legacy callback
// shape) in Promises so callers can `await` them.

interface ExceptionInfo {
  isError?: boolean;
  isException?: boolean;
  code?: string;
  description?: string;
  value?: string;
}

// True only when the panel is loaded inside DevTools (chrome.devtools.* is
// injected by Chrome at that point). When the panel HTML is opened as a
// plain extension page, chrome.devtools is undefined — every helper below
// should refuse to call into it.
export function hasInspectedWindow(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.devtools !== 'undefined' &&
    typeof chrome.devtools.inspectedWindow !== 'undefined' &&
    typeof chrome.devtools.inspectedWindow.eval === 'function'
  );
}

export const NOT_IN_DEVTOOLS_MESSAGE =
  'This feature only works in the DevTools panel. Right-click any page → Inspect → Phantom Mock.';

export function evalInInspected<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!hasInspectedWindow()) {
      reject(new Error(NOT_IN_DEVTOOLS_MESSAGE));
      return;
    }
    chrome.devtools.inspectedWindow.eval(
      expression,
      (result: unknown, exceptionInfo: ExceptionInfo | undefined) => {
        if (exceptionInfo && (exceptionInfo.isError || exceptionInfo.isException)) {
          reject(
            new Error(
              exceptionInfo.value || exceptionInfo.description || 'inspectedWindow.eval failed'
            )
          );
          return;
        }
        resolve(result as T);
      }
    );
  });
}

// JSON.stringify on the key/value escapes them into a real JS string literal,
// so embedded quotes/backslashes can't break out of the expression. Safer than
// raw interpolation.
export function getLocalStorage(key: string): Promise<string | null> {
  return evalInInspected<string | null>(`window.localStorage.getItem(${JSON.stringify(key)})`);
}

export function setLocalStorage(key: string, value: string): Promise<void> {
  return evalInInspected<void>(
    `void window.localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`
  );
}

export function removeLocalStorage(key: string): Promise<void> {
  return evalInInspected<void>(`void window.localStorage.removeItem(${JSON.stringify(key)})`);
}

export function reloadInspectedPage(): void {
  if (!hasInspectedWindow()) return;
  chrome.devtools.inspectedWindow.reload({ ignoreCache: false });
}
