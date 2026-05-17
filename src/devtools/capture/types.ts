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
  requestHeaders: CapturedHeader[];
  requestBody: string | null;
  requestContentType: string | null;
  responseHeaders: CapturedHeader[];
  responseBody: string | null;
  responseContentType: string;
  responseEncoding: 'utf8' | 'base64';
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
