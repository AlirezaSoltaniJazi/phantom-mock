import {
  CAPTURE_RESOURCE_TYPE_LABELS,
  type CaptureExportField,
  type CaptureExportOptions,
} from '@/shared/types';
import { createZip } from '@/shared/zip';
import { formatBytes, formatDuration, responseSizeBytes, type CapturedEntry } from './types';

// Headers Chrome reports but curl either rejects or sets itself.
const CURL_SKIPPED_HEADERS = new Set(['content-length', 'host', 'connection']);

const SECRET_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
]);
const SECRET_HEADER_PATTERN = /token|secret|api[-_]?key|session|csrf|xsrf/i;
export const REDACTED = '[redacted]';

export function isSecretHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_HEADERS.has(lower) || SECRET_HEADER_PATTERN.test(lower);
}

type HeaderList = CapturedEntry['requestHeaders'];

function redactHeaders(headers: HeaderList): HeaderList {
  return headers.map((h) => (isSecretHeader(h.name) ? { ...h, value: REDACTED } : h));
}

export function redactSecrets(entry: CapturedEntry): CapturedEntry {
  return {
    ...entry,
    requestHeaders: redactHeaders(entry.requestHeaders),
    responseHeaders: redactHeaders(entry.responseHeaders),
  };
}

function prepare(entry: CapturedEntry, options: CaptureExportOptions): CapturedEntry {
  return options.includeSecrets ? entry : redactSecrets(entry);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildCurl(entry: CapturedEntry): string {
  const lines: string[] = [`curl ${shellQuote(entry.url)}`];
  const method = entry.method.toUpperCase();
  // Quote the method too: HTTP token syntax allows ` $ | & — a page can send
  // fetch(url, { method: 'A`cmd`' }) and plant a command in the pasted curl.
  if (method !== 'GET') lines.push(`  -X ${shellQuote(method)}`);
  for (const header of entry.requestHeaders) {
    // HTTP/2 pseudo-headers (:method, :path, …) aren't real headers.
    if (header.name.startsWith(':')) continue;
    if (CURL_SKIPPED_HEADERS.has(header.name.toLowerCase())) continue;
    lines.push(`  -H ${shellQuote(`${header.name}: ${header.value}`)}`);
  }
  if (entry.requestBody) lines.push(`  --data-raw ${shellQuote(entry.requestBody)}`);
  lines.push('  --compressed');
  return lines.join(' \\\n');
}

function headerBlock(headers: ReadonlyArray<{ name: string; value: string }>): string {
  if (headers.length === 0) return '(none)';
  return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
}

function fence(body: string, lang: string): string {
  // A body containing ``` would break a 3-backtick fence, so widen it past
  // the longest run in the body.
  const longest = Math.max(0, ...Array.from(body.matchAll(/`{3,}/g), (m) => m[0].length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}${lang}\n${body}\n${ticks}`;
}

function bodyLanguage(contentType: string | null): string {
  const mime = (contentType ?? '').toLowerCase();
  if (mime.includes('json')) return 'json';
  if (mime.includes('html')) return 'html';
  if (mime.includes('xml')) return 'xml';
  if (mime.includes('javascript')) return 'js';
  if (mime.includes('css')) return 'css';
  return '';
}

function prettyIfJson(body: string, contentType: string | null): string {
  if (!(contentType ?? '').toLowerCase().includes('json')) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function has(options: CaptureExportOptions, field: CaptureExportField): boolean {
  return options.fields[field];
}

export function buildEntryDocument(raw: CapturedEntry, options: CaptureExportOptions): string {
  const entry = prepare(raw, options);
  const out: string[] = [`# ${entry.method.toUpperCase()} ${entry.path || '/'}`, ''];

  const meta: string[] = [`- URL: ${entry.url}`];
  if (has(options, 'timestamp')) meta.push(`- Time: ${new Date(entry.ts).toISOString()}`);
  if (has(options, 'status')) {
    meta.push(`- Status: ${entry.status || '—'} ${entry.statusText}`.trimEnd());
  }
  if (has(options, 'duration')) meta.push(`- Duration: ${formatDuration(entry.durationMs)}`);
  if (has(options, 'size')) meta.push(`- Size: ${formatBytes(responseSizeBytes(entry))}`);
  if (has(options, 'resourceType')) {
    meta.push(`- Type: ${CAPTURE_RESOURCE_TYPE_LABELS[entry.resourceType]}`);
  }
  out.push(meta.join('\n'), '');

  if (has(options, 'curl')) {
    out.push('## Request (curl)', '', fence(buildCurl(entry), 'bash'), '');
  }
  if (has(options, 'requestHeaders')) {
    out.push('## Request headers', '', fence(headerBlock(entry.requestHeaders), ''), '');
  }
  if (has(options, 'requestBody')) {
    const body = entry.requestBody
      ? prettyIfJson(entry.requestBody, entry.requestContentType)
      : '(no body)';
    out.push('## Request body', '', fence(body, bodyLanguage(entry.requestContentType)), '');
  }
  if (has(options, 'responseHeaders')) {
    out.push('## Response headers', '', fence(headerBlock(entry.responseHeaders), ''), '');
  }
  if (has(options, 'responseBody')) {
    const label =
      entry.responseEncoding === 'base64' ? '## Response body (base64)' : '## Response body';
    const body = entry.responseBody
      ? prettyIfJson(entry.responseBody, entry.responseContentType)
      : '(no body captured)';
    out.push(label, '', fence(body, bodyLanguage(entry.responseContentType)), '');
  }

  return `${out.join('\n').trimEnd()}\n`;
}

export function fileNameFor(entry: CapturedEntry, index: number): string {
  const slugSource = `${entry.host}${entry.path}`
    .replace(/https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const ordinal = String(index + 1).padStart(3, '0');
  return `${ordinal}-${entry.method.toUpperCase()}-${slugSource || 'request'}.md`;
}

export function buildCombinedDocument(
  entries: CapturedEntry[],
  options: CaptureExportOptions
): string {
  const header = `# Phantom Mock capture — ${entries.length} request${entries.length === 1 ? '' : 's'}\n\nExported ${new Date().toISOString()}\n`;
  return [header, ...entries.map((e) => buildEntryDocument(e, options))].join('\n---\n\n');
}

export function buildJsonDocument(entries: CapturedEntry[], options: CaptureExportOptions): string {
  const payload = entries.map((raw) => {
    const entry = prepare(raw, options);
    const record: Record<string, unknown> = {
      method: entry.method,
      url: entry.url,
    };
    if (has(options, 'timestamp')) record.timestamp = new Date(entry.ts).toISOString();
    if (has(options, 'status')) {
      record.status = entry.status;
      record.statusText = entry.statusText;
    }
    if (has(options, 'duration')) record.durationMs = entry.durationMs;
    if (has(options, 'size')) record.responseSizeBytes = responseSizeBytes(entry);
    if (has(options, 'resourceType')) record.resourceType = entry.resourceType;
    if (has(options, 'curl')) record.curl = buildCurl(entry);
    if (has(options, 'requestHeaders')) record.requestHeaders = entry.requestHeaders;
    if (has(options, 'requestBody')) record.requestBody = entry.requestBody;
    if (has(options, 'responseHeaders')) record.responseHeaders = entry.responseHeaders;
    if (has(options, 'responseBody')) {
      record.responseBody = entry.responseBody;
      record.responseEncoding = entry.responseEncoding;
    }
    return record;
  });
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export interface ExportArtifact {
  fileName: string;
  blob: Blob;
}

function timestampSlug(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function buildExport(
  entries: CapturedEntry[],
  options: CaptureExportOptions,
  now: Date = new Date()
): ExportArtifact {
  const stamp = timestampSlug(now);
  if (options.format === 'json') {
    return {
      fileName: `phantom-mock-capture-${stamp}.json`,
      blob: new Blob([buildJsonDocument(entries, options)], { type: 'application/json' }),
    };
  }
  if (options.format === 'single') {
    return {
      fileName: `phantom-mock-capture-${stamp}.md`,
      blob: new Blob([buildCombinedDocument(entries, options)], { type: 'text/markdown' }),
    };
  }
  const zip = createZip(
    entries.map((entry, i) => ({
      name: fileNameFor(entry, i),
      content: buildEntryDocument(entry, options),
    })),
    now
  );
  return {
    fileName: `phantom-mock-capture-${stamp}.zip`,
    // Copy into a fresh buffer: Blob wants an ArrayBuffer-backed view and the
    // zip writer's output may be a view over a larger allocation.
    blob: new Blob([new Uint8Array(zip).buffer as ArrayBuffer], { type: 'application/zip' }),
  };
}

export function downloadArtifact(artifact: ExportArtifact): void {
  const url = URL.createObjectURL(artifact.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifact.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the download has picked the blob up.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
