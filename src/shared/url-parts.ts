import type { Rule } from './types';

export interface UrlParts {
  scheme: 'http' | 'https' | 'other' | null;
  host: string | null;
  baseDomain: string | null;
  subdomain: string | null;
  path: string;
}

// Multi-label public suffixes we want to keep together when computing the
// registrable domain. Not a full PSL — just the common ccTLDs that bite us most.
const TWO_LABEL_TLDS = new Set([
  'co.uk',
  'co.jp',
  'co.kr',
  'co.in',
  'co.nz',
  'co.za',
  'com.au',
  'com.br',
  'com.cn',
  'com.mx',
  'com.tr',
  'com.sg',
  'com.hk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'ne.jp',
  'or.jp',
]);

function isIp(host: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (host.startsWith('[') && host.endsWith(']')) return true; // IPv6
  return false;
}

export function baseDomainOf(host: string): string {
  const hostname = host.split(':')[0] ?? host;
  if (!hostname || isIp(hostname)) return hostname;
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) return hostname;
  const lastTwo = labels.slice(-2).join('.');
  if (TWO_LABEL_TLDS.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

export function subdomainOf(host: string): string | null {
  const hostname = host.split(':')[0] ?? host;
  const base = baseDomainOf(hostname);
  if (hostname === base) return null;
  const suffix = `.${base}`;
  return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : null;
}

function tryParse(value: string): UrlParts | null {
  try {
    const u = new URL(value);
    const scheme: UrlParts['scheme'] =
      u.protocol === 'https:' ? 'https' : u.protocol === 'http:' ? 'http' : 'other';
    const host = u.host;
    return {
      scheme,
      host,
      baseDomain: baseDomainOf(host),
      subdomain: subdomainOf(host),
      path: `${u.pathname}${u.search}${u.hash}`,
    };
  } catch {
    return null;
  }
}

export function deriveUrlParts(rule: Rule): UrlParts {
  const fromName = tryParse(rule.name);
  if (fromName?.host) return fromName;
  const fromPattern = tryParse(rule.match.urlPattern);
  if (fromPattern?.host) return fromPattern;
  // Pattern is just a fragment / path / regex — keep the raw string as the path.
  return {
    scheme: null,
    host: null,
    baseDomain: null,
    subdomain: null,
    path: rule.match.urlPattern || rule.name,
  };
}

/** Convenience extractor for Rule items — falls back from rule.name to rule.match.urlPattern. */
export function ruleToUrl(rule: Rule): UrlParts {
  return deriveUrlParts(rule);
}

/** Convenience extractor for plain URL strings (e.g. CapturedEntry.url). */
export function urlToParts(url: string): UrlParts {
  const parsed = tryParse(url);
  if (parsed) return parsed;
  return { scheme: null, host: null, baseDomain: null, subdomain: null, path: url };
}

export interface DomainBucket<T> {
  baseDomain: string | null;
  scheme: UrlParts['scheme'];
  items: T[];
}

/**
 * Groups items by the registrable domain of their URL (last 2 host labels,
 * with a small allow-list for two-part ccTLDs). Items whose URL is not parseable
 * fall under a `null` baseDomain bucket.
 */
export function bucketByBaseDomain<T>(
  items: T[],
  extract: (item: T) => UrlParts
): DomainBucket<T>[] {
  const order: string[] = [];
  const map = new Map<string, DomainBucket<T>>();
  for (const item of items) {
    const parts = extract(item);
    const key = parts.baseDomain ?? '__noHost__';
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { baseDomain: parts.baseDomain, scheme: parts.scheme, items: [] };
      map.set(key, bucket);
      order.push(key);
    } else if (bucket.scheme === null && parts.scheme) {
      bucket.scheme = parts.scheme;
    }
    bucket.items.push(item);
  }
  return order.map((k) => map.get(k)).filter((b): b is DomainBucket<T> => Boolean(b));
}

export interface SubdomainBucket<T> {
  subdomain: string | null;
  items: T[];
}

/**
 * Within a single base-domain bucket, further group items by their subdomain
 * prefix (e.g. `kinexus.emea.validation` vs `kinexus.admin.emea.validation`).
 * Items pointed directly at the registrable domain land under `subdomain: null`.
 */
export function bucketBySubdomain<T>(
  items: T[],
  extract: (item: T) => UrlParts
): SubdomainBucket<T>[] {
  const order: string[] = [];
  const map = new Map<string, SubdomainBucket<T>>();
  for (const item of items) {
    const parts = extract(item);
    const key = parts.subdomain ?? '__root__';
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { subdomain: parts.subdomain, items: [] };
      map.set(key, bucket);
      order.push(key);
    }
    bucket.items.push(item);
  }
  return order.map((k) => map.get(k)).filter((b): b is SubdomainBucket<T> => Boolean(b));
}
