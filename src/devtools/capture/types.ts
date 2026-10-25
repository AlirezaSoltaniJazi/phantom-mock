import type { CaptureResourceType } from '@/shared/types';

export interface CapturedHeader {
  name: string;
  value: string;
}

export interface CapturedEntry {
  id: string;
  ts: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  statusText: string;
  durationMs: number | null;
  requestHeaders: CapturedHeader[];
  requestBody: string | null;
  requestContentType: string | null;
  responseHeaders: CapturedHeader[];
  responseBody: string | null;
  responseContentType: string;
  responseEncoding: 'utf8' | 'base64';
  // Chrome's Network-panel bucket for this request. Entries captured before
  // this field existed are normalized on read — see normalizeEntry().
  resourceType: CaptureResourceType;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function matchesHostFilter(url: string, filter: string): boolean {
  const trimmed = filter.trim();
  if (!trimmed) return true;
  try {
    const u = new URL(url);
    return u.host.toLowerCase().includes(trimmed.toLowerCase());
  } catch {
    return url.toLowerCase().includes(trimmed.toLowerCase());
  }
}

export function approxBodySize(body: string | null): string {
  if (!body) return '0 B';
  const bytes = new Blob([body]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function responseSizeBytes(entry: CapturedEntry): number {
  if (entry.responseBody) {
    return entry.responseEncoding === 'base64'
      ? Math.floor((entry.responseBody.length * 3) / 4)
      : new Blob([entry.responseBody]).size;
  }
  const header = entry.responseHeaders.find((h) => h.name.toLowerCase() === 'content-length');
  const parsed = header ? Number.parseInt(header.value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
