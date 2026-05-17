import { STORAGE_KEYS } from '@/shared/constants';
import { newId } from '@/utils/id';
import type { CapturedEntry, CapturedHeader } from './capture/types';

// When the extension is reloaded while DevTools is still open, this old
// devtools.ts instance's chrome.* APIs become invalid. Any subsequent call
// throws synchronously with "Extension context invalidated". Detect it once
// and turn every further chrome.* call into a no-op so we don't spam the
// errors panel.
let contextValid = true;

function safe(fn: () => void): void {
  if (!contextValid) return;
  try {
    fn();
  } catch (err) {
    const msg = (err as Error | undefined)?.message ?? '';
    if (msg.includes('Extension context invalidated')) {
      contextValid = false;
      return;
    }
    console.warn('[phantom-mock] devtools error', err);
  }
}

safe(() =>
  chrome.devtools.panels.create(
    'Phantom Mock',
    'public/icons/icon-32.png',
    'src/devtools/panel.html',
    () => undefined
  )
);

// Capture every request the moment DevTools opens (not when the user finally
// clicks the Phantom Mock panel). chrome.devtools.network.getHAR() only sees
// requests that fired *after* this devtools_page registered, so pre-registering
// here closes that gap as much as Chrome allows.

const MAX_ENTRIES = 100;
const MAX_BODY_LEN = 100 * 1024;
const WRITE_DEBOUNCE_MS = 150;

let buffer: CapturedEntry[] = [];
let recording = true;
let pendingWrite: ReturnType<typeof setTimeout> | null = null;

safe(() => {
  void chrome.storage.session
    .get([STORAGE_KEYS.CAPTURE_BUFFER, STORAGE_KEYS.CAPTURE_RECORDING])
    .then((r) => {
      const buf = r[STORAGE_KEYS.CAPTURE_BUFFER];
      if (Array.isArray(buf)) buffer = buf as CapturedEntry[];
      const rec = r[STORAGE_KEYS.CAPTURE_RECORDING];
      if (typeof rec === 'boolean') recording = rec;
    })
    .catch(() => undefined);
});

safe(() => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session') return;
    const recCh = changes[STORAGE_KEYS.CAPTURE_RECORDING];
    if (recCh && typeof recCh.newValue === 'boolean') {
      recording = recCh.newValue;
    }
    const bufCh = changes[STORAGE_KEYS.CAPTURE_BUFFER];
    if (bufCh && Array.isArray(bufCh.newValue)) {
      // Panel (or another devtools instance) replaced the buffer — usually a
      // Clear or a load-from-snapshot. Re-sync our in-memory view.
      buffer = bufCh.newValue as CapturedEntry[];
    }
  });
});

function scheduleWrite(): void {
  if (!contextValid) return;
  if (pendingWrite !== null) return;
  pendingWrite = setTimeout(() => {
    pendingWrite = null;
    safe(() => {
      void chrome.storage.session.set({ [STORAGE_KEYS.CAPTURE_BUFFER]: buffer }).catch((err) => {
        const msg = (err as Error | undefined)?.message ?? '';
        if (msg.includes('Extension context invalidated')) {
          contextValid = false;
          return;
        }
        console.warn('[phantom-mock] capture buffer write failed', err);
      });
    });
  }, WRITE_DEBOUNCE_MS);
}

function toHeaders(headers: ReadonlyArray<{ name: string; value: string }>): CapturedHeader[] {
  return headers.map((h) => ({ name: h.name, value: h.value }));
}

function findHeader(headers: CapturedHeader[], name: string): string | null {
  const lower = name.toLowerCase();
  const hit = headers.find((h) => h.name.toLowerCase() === lower);
  return hit ? hit.value : null;
}

function truncate(text: string | null): string | null {
  if (text === null) return null;
  if (text.length <= MAX_BODY_LEN) return text;
  return `${text.slice(0, MAX_BODY_LEN)}\n…[truncated, original ${text.length} chars]`;
}

function appendEntry(entry: CapturedEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  scheduleWrite();
}

safe(() =>
  chrome.devtools.network.onRequestFinished.addListener((req) => {
    if (!recording || !contextValid) return;
    handleRequest(req);
  })
);

function handleRequest(req: chrome.devtools.network.Request): void {
  const url = req.request.url;
  const requestHeaders = toHeaders(req.request.headers);
  const responseHeaders = toHeaders(req.response.headers);
  const requestBody = req.request.postData?.text ?? null;
  let host = url;
  let path = url;
  try {
    const u = new URL(url);
    host = u.host;
    path = `${u.pathname}${u.search}${u.hash}`;
  } catch {
    /* leave as-is */
  }
  const base = {
    id: newId('cap'),
    ts: Date.now(),
    method: req.request.method,
    url,
    host,
    path,
    status: req.response.status,
    statusText: req.response.statusText ?? '',
    durationMs: typeof req.time === 'number' && req.time >= 0 ? req.time : null,
    requestHeaders,
    requestBody: truncate(requestBody),
    requestContentType: findHeader(requestHeaders, 'content-type'),
    responseHeaders,
    responseContentType: req.response.content?.mimeType ?? '',
  };
  try {
    req.getContent((content, encoding) => {
      appendEntry({
        ...base,
        responseBody: typeof content === 'string' ? truncate(content) : null,
        responseEncoding: encoding === 'base64' ? 'base64' : 'utf8',
      });
    });
  } catch {
    appendEntry({ ...base, responseBody: null, responseEncoding: 'utf8' });
  }
}
