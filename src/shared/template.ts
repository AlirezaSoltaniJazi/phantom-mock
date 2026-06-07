// Friendly placeholder tokens shared by URL matching ("accept any value") and
// mock response bodies ("generate a random value"):
//
//   {random}     URL  → matches any value within a path segment ([^/]+)
//                body → a random alphanumeric string of the default length
//   {random:N}   URL  → matches exactly N alphanumeric chars ([A-Za-z0-9]{N})
//                body → N freshly generated random alphanumeric chars
//
// Matching compiles the template to a regex (literals are escaped, tokens become
// character classes); generation substitutes a NEW random value on every call.
// So one rule like `/devices/{random}/details` matches every id, and a body of
// `{"id":"{random:20}"}` returns a fresh 20-char id per request.

const RANDOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const DEFAULT_RANDOM_LENGTH = 16;
const MAX_RANDOM_LENGTH = 4096;

// {random} or {random:N} — capture group 1 is the optional length. Built fresh
// per use (never shared) so the `g` flag's lastIndex can't leak between calls.
const TOKEN_SOURCE = '\\{random(?::(\\d+))?\\}';

function escapeRegexLiteral(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a template string into a regex source. Literal text is escaped; each
 * {random}/{random:N} token expands to a character class. Used for URL matching
 * in both the page-world matcher and declarativeNetRequest header rules.
 */
export function templateToRegexSource(template: string): string {
  const tokenRe = new RegExp(TOKEN_SOURCE, 'g');
  let out = '';
  let last = 0;
  for (const m of template.matchAll(tokenRe)) {
    const idx = m.index ?? 0;
    out += escapeRegexLiteral(template.slice(last, idx));
    out += m[1] ? `[A-Za-z0-9]{${m[1]}}` : '[^/]+';
    last = idx + m[0].length;
  }
  out += escapeRegexLiteral(template.slice(last));
  return out;
}

export function compileTemplate(template: string): RegExp | null {
  try {
    return new RegExp(templateToRegexSource(template));
  } catch {
    return null;
  }
}

export function hasTemplateTokens(text: string): boolean {
  return new RegExp(TOKEN_SOURCE).test(text);
}

function randomAlnum(length: number): string {
  const n = Math.max(0, Math.min(MAX_RANDOM_LENGTH, Math.floor(length)));
  let out = '';
  const webCrypto =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? crypto : null;
  if (webCrypto) {
    const bytes = new Uint8Array(n);
    webCrypto.getRandomValues(bytes);
    for (let i = 0; i < n; i++) {
      out += RANDOM_ALPHABET.charAt((bytes[i] ?? 0) % RANDOM_ALPHABET.length);
    }
  } else {
    for (let i = 0; i < n; i++) {
      out += RANDOM_ALPHABET.charAt(Math.floor(Math.random() * RANDOM_ALPHABET.length));
    }
  }
  return out;
}

/**
 * Replace every {random}/{random:N} token with a freshly generated random
 * alphanumeric string. {random} with no length uses the default length. Text
 * without tokens is returned unchanged. Used for mock response bodies.
 */
export function renderRandomTokens(text: string): string {
  const tokenRe = new RegExp(TOKEN_SOURCE, 'g');
  return text.replace(tokenRe, (_full, len: string | undefined) =>
    randomAlnum(len ? Number(len) : DEFAULT_RANDOM_LENGTH)
  );
}
