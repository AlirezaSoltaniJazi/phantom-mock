import { useCallback, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '@/shared/constants';
import { newId } from '@/utils/id';
import { matchesHostFilter, type CapturedEntry, type CapturedHeader } from './types';

export interface UseCaptureOptions {
  hostFilter: string;
  recording: boolean;
}

export interface ImportSummary {
  total: number;
  matched: number;
}

export interface UseCaptureResult {
  entries: CapturedEntry[];
  clear: () => void;
  importFromNetworkLog: () => Promise<ImportSummary>;
  reloadInspectedPage: () => void;
}

type HarHeader = { name: string; value: string };

function toCapturedHeaders(headers: ReadonlyArray<HarHeader>): CapturedHeader[] {
  return headers.map((h) => ({ name: h.name, value: h.value }));
}

function findHeader(headers: CapturedHeader[], name: string): string | null {
  const lower = name.toLowerCase();
  const hit = headers.find((h) => h.name.toLowerCase() === lower);
  return hit ? hit.value : null;
}

// Plain HAR entry as returned by chrome.devtools.network.getHAR() — no getContent
// method, body lives at entry.response.content.text.
interface HarEntryLike {
  request?: {
    method?: string;
    url?: string;
    headers?: HarHeader[];
    postData?: { text?: string; mimeType?: string };
  };
  response?: {
    status?: number;
    statusText?: string;
    headers?: HarHeader[];
    content?: { text?: string; encoding?: string; mimeType?: string };
  };
  startedDateTime?: string;
}

function buildEntryFromHar(e: HarEntryLike): CapturedEntry {
  const url = e.request?.url ?? '';
  const requestHeaders = toCapturedHeaders(e.request?.headers ?? []);
  const responseHeaders = toCapturedHeaders(e.response?.headers ?? []);
  const requestContentType = findHeader(requestHeaders, 'content-type');
  const requestBody = e.request?.postData?.text ?? null;
  let host = url;
  let path = url;
  try {
    const u = new URL(url);
    host = u.host;
    path = `${u.pathname}${u.search}${u.hash}`;
  } catch {
    /* leave as-is */
  }
  const content = e.response?.content;
  const ts = e.startedDateTime ? new Date(e.startedDateTime).getTime() : Date.now();
  return {
    id: newId('cap'),
    ts,
    method: e.request?.method ?? 'GET',
    url,
    host,
    path,
    status: e.response?.status ?? 0,
    statusText: e.response?.statusText ?? '',
    requestHeaders,
    requestBody,
    requestContentType,
    responseHeaders,
    responseBody: typeof content?.text === 'string' ? content.text : null,
    responseContentType: content?.mimeType ?? '',
    responseEncoding: content?.encoding === 'base64' ? 'base64' : 'utf8',
  };
}

export function useCapture({ hostFilter, recording }: UseCaptureOptions): UseCaptureResult {
  // Single source of truth for captured entries is chrome.storage.session,
  // populated by devtools.ts (which registers the onRequestFinished listener as
  // early as DevTools open). We read it and subscribe to changes.
  const [allEntries, setAllEntries] = useState<CapturedEntry[]>([]);

  useEffect(() => {
    let mounted = true;
    void chrome.storage.session
      .get(STORAGE_KEYS.CAPTURE_BUFFER)
      .then((r) => {
        if (!mounted) return;
        const buf = r[STORAGE_KEYS.CAPTURE_BUFFER];
        if (Array.isArray(buf)) setAllEntries(buf as CapturedEntry[]);
      })
      .catch(() => undefined);

    const handler = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: chrome.storage.AreaName
    ): void => {
      if (area !== 'session') return;
      const change = changes[STORAGE_KEYS.CAPTURE_BUFFER];
      if (change && Array.isArray(change.newValue)) {
        setAllEntries(change.newValue as CapturedEntry[]);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(handler);
    };
  }, []);

  // Propagate recording toggle to storage.session so devtools.ts can read it.
  useEffect(() => {
    void chrome.storage.session
      .set({ [STORAGE_KEYS.CAPTURE_RECORDING]: recording })
      .catch(() => undefined);
  }, [recording]);

  const filtered = useMemo(
    () => allEntries.filter((e) => matchesHostFilter(e.url, hostFilter)),
    [allEntries, hostFilter]
  );

  const clear = useCallback(() => {
    setAllEntries([]);
    void chrome.storage.session.set({ [STORAGE_KEYS.CAPTURE_BUFFER]: [] }).catch(() => undefined);
  }, []);

  const importFromNetworkLog = useCallback(async (): Promise<ImportSummary> => {
    if (!chrome.devtools?.network?.getHAR) return { total: 0, matched: 0 };
    const har = await new Promise<unknown>((resolve) => {
      chrome.devtools.network.getHAR((h) => resolve(h));
    });
    const harObj = har as { entries?: unknown; log?: { entries?: unknown } };
    const raw = Array.isArray(harObj.entries)
      ? harObj.entries
      : Array.isArray(harObj.log?.entries)
        ? (harObj.log.entries as unknown[])
        : [];
    const entries = raw as HarEntryLike[];
    const matched = entries.filter((e) => matchesHostFilter(e.request?.url ?? '', hostFilter));
    if (matched.length > 0) {
      const built = matched.map(buildEntryFromHar);
      const current = (await chrome.storage.session.get(STORAGE_KEYS.CAPTURE_BUFFER))[
        STORAGE_KEYS.CAPTURE_BUFFER
      ];
      const existing: CapturedEntry[] = Array.isArray(current) ? (current as CapturedEntry[]) : [];
      const next = [...existing, ...built];
      await chrome.storage.session.set({ [STORAGE_KEYS.CAPTURE_BUFFER]: next });
    }
    return { total: entries.length, matched: matched.length };
  }, [hostFilter]);

  const reloadInspectedPage = useCallback(() => {
    chrome.devtools?.inspectedWindow?.reload?.({ ignoreCache: false });
  }, []);

  return {
    entries: filtered,
    clear,
    importFromNetworkLog,
    reloadInspectedPage,
  };
}
