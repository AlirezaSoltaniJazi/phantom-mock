import { describe, expect, it } from 'vitest';
import {
  compileTemplate,
  hasTemplateTokens,
  renderRandomTokens,
  templateToRegexSource,
} from '@/shared/template';
import { specMatches } from '@/shared/matcher';

describe('templateToRegexSource', () => {
  it('expands {random} to a non-slash run and keeps literals', () => {
    expect(templateToRegexSource('/devices/{random}/details')).toBe('/devices/[^/]+/details');
  });

  it('expands {random:N} to an N-length alphanumeric class', () => {
    expect(templateToRegexSource('/devices/{random:20}/details')).toBe(
      '/devices/[A-Za-z0-9]{20}/details'
    );
  });

  it('escapes regex-special literal characters', () => {
    // The dot and question mark are literals here, not regex metacharacters.
    expect(templateToRegexSource('/a.b?c/{random}')).toBe('/a\\.b\\?c/[^/]+');
  });

  it('handles multiple tokens in one template', () => {
    expect(templateToRegexSource('/{random}/x/{random:8}')).toBe('/[^/]+/x/[A-Za-z0-9]{8}');
  });
});

describe('compileTemplate matching', () => {
  it('{random} matches any value in the segment', () => {
    const re = compileTemplate('/devices/{random}/details');
    expect(re).not.toBeNull();
    expect(re?.test('https://x.com/devices/6736292d6857c5e312b82caa08baa9d1/details')).toBe(true);
    expect(re?.test('https://x.com/devices/abc/details')).toBe(true);
  });

  it('{random} stays within one path segment (no slashes)', () => {
    const re = compileTemplate('/devices/{random}/details');
    expect(re?.test('https://x.com/devices/a/b/details')).toBe(false);
  });

  it('{random:20} requires exactly 20 chars between the literals', () => {
    const re = compileTemplate('/devices/{random:20}/details');
    expect(re?.test('/devices/abcdefghij0123456789/details')).toBe(true); // 20
    expect(re?.test('/devices/abcdefghij012345678/details')).toBe(false); // 19
    expect(re?.test('/devices/abcdefghij01234567890/details')).toBe(false); // 21
  });
});

describe('specMatches with the template match type', () => {
  it('matches a dynamic id via a template rule', () => {
    const spec = {
      method: '*' as const,
      urlMatchType: 'template' as const,
      urlPattern: '/devices/{random}/details',
    };
    expect(specMatches(spec, 'https://x.com/devices/ZZZ999/details', 'GET')).toBe(true);
    expect(specMatches(spec, 'https://x.com/devices/ZZZ999/summary', 'GET')).toBe(false);
  });
});

describe('renderRandomTokens (response generation)', () => {
  it('replaces {random:N} with N alphanumeric characters', () => {
    const out = renderRandomTokens('{random:20}');
    expect(out).toMatch(/^[A-Za-z0-9]{20}$/);
  });

  it('replaces {random} with a default-length alphanumeric string', () => {
    const out = renderRandomTokens('{random}');
    expect(out).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('substitutes inside a JSON body and leaves the rest intact', () => {
    const out = renderRandomTokens('{"type":"HARMONY","id":"{random:32}","isEmpty":true}');
    const parsed = JSON.parse(out) as { type: string; id: string; isEmpty: boolean };
    expect(parsed.type).toBe('HARMONY');
    expect(parsed.isEmpty).toBe(true);
    expect(parsed.id).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it('generates a fresh value each call', () => {
    const a = renderRandomTokens('{random:32}');
    const b = renderRandomTokens('{random:32}');
    expect(a).not.toBe(b);
  });

  it('leaves text without tokens unchanged', () => {
    expect(renderRandomTokens('{"id":"static"}')).toBe('{"id":"static"}');
  });
});

describe('hasTemplateTokens', () => {
  it('detects tokens', () => {
    expect(hasTemplateTokens('/a/{random}/b')).toBe(true);
    expect(hasTemplateTokens('id={random:8}')).toBe(true);
  });
  it('is false when there are none', () => {
    expect(hasTemplateTokens('/a/b/c')).toBe(false);
  });
});
