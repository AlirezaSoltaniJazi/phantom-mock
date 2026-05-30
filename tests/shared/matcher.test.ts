import { describe, expect, it } from 'vitest';
import {
  buildActiveView,
  findFirstMockMatch,
  isRuleActive,
  methodMatches,
  specMatches,
  urlMatches,
} from '@/shared/matcher';
import { CURRENT_SCHEMA_VERSION, type AppState, type Rule } from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';

function makeMockRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule_1',
    name: 'Mock users',
    groupId: DEFAULT_GROUP_ID,
    enabled: true,
    match: { method: 'GET', urlMatchType: 'contains', urlPattern: 'api.github.com/users' },
    action: {
      kind: 'mock',
      statusCode: 200,
      delayMs: 0,
      responseBody: '{"login":"phantom"}',
      responseContentType: 'application/json',
      responseHeaders: [],
      logToPanel: true,
    },
    ...overrides,
  };
}

function makeState(rules: Rule[], masterEnabled = true): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled,
    groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
    rules,
    storageProfiles: [],
    cookieProfiles: [],
  };
}

describe('methodMatches', () => {
  it('matches case-insensitively', () => {
    expect(methodMatches('GET', 'get')).toBe(true);
    expect(methodMatches('POST', 'POST')).toBe(true);
  });

  it('wildcard matches anything', () => {
    expect(methodMatches('*', 'PATCH')).toBe(true);
    expect(methodMatches('*', 'whatever')).toBe(true);
  });

  it('rejects mismatched methods', () => {
    expect(methodMatches('GET', 'POST')).toBe(false);
  });
});

describe('urlMatches', () => {
  it('exact comparison is strict', () => {
    const spec = {
      method: '*' as const,
      urlMatchType: 'exact' as const,
      urlPattern: 'https://a.com/x',
    };
    expect(urlMatches(spec, 'https://a.com/x')).toBe(true);
    expect(urlMatches(spec, 'https://a.com/x?y=1')).toBe(false);
  });

  it('contains is a substring check, empty pattern never matches', () => {
    const spec = {
      method: '*' as const,
      urlMatchType: 'contains' as const,
      urlPattern: '/users',
    };
    expect(urlMatches(spec, 'https://api.github.com/users/1')).toBe(true);
    expect(urlMatches(spec, 'https://api.github.com/repos')).toBe(false);
    expect(
      urlMatches({ method: '*', urlMatchType: 'contains', urlPattern: '' }, 'https://a.com')
    ).toBe(false);
  });

  it('regex compiles and applies; invalid regex never matches', () => {
    expect(
      urlMatches(
        { method: '*', urlMatchType: 'regex', urlPattern: '^https://[a-z]+\\.com/\\d+$' },
        'https://x.com/42'
      )
    ).toBe(true);
    expect(
      urlMatches(
        { method: '*', urlMatchType: 'regex', urlPattern: '[unclosed' },
        'https://x.com/42'
      )
    ).toBe(false);
  });
});

describe('specMatches', () => {
  it('requires both url and method to match', () => {
    const spec = {
      method: 'POST' as const,
      urlMatchType: 'contains' as const,
      urlPattern: '/login',
    };
    expect(specMatches(spec, 'https://a.com/login', 'POST')).toBe(true);
    expect(specMatches(spec, 'https://a.com/login', 'GET')).toBe(false);
    expect(specMatches(spec, 'https://a.com/logout', 'POST')).toBe(false);
  });
});

describe('isRuleActive', () => {
  it('honors master, rule, and group toggles', () => {
    const rule = makeMockRule();
    const state = makeState([rule]);
    const view = buildActiveView(state);
    expect(isRuleActive(rule, view, true)).toBe(true);
    expect(isRuleActive(rule, view, false)).toBe(false);
    expect(isRuleActive({ ...rule, enabled: false }, view, true)).toBe(false);
    const offView = buildActiveView({
      ...state,
      groups: state.groups.map((g) => ({ ...g, enabled: false })),
    });
    expect(isRuleActive(rule, offView, true)).toBe(false);
  });
});

describe('findFirstMockMatch', () => {
  it('returns the first enabled mock rule that matches', () => {
    const r1 = makeMockRule({ id: 'r1', enabled: false });
    const r2 = makeMockRule({ id: 'r2' });
    const state = makeState([r1, r2]);
    const hit = findFirstMockMatch(state, 'https://api.github.com/users/octocat', 'GET');
    expect(hit?.id).toBe('r2');
  });

  it('returns undefined when master is off', () => {
    const state = makeState([makeMockRule()], false);
    expect(findFirstMockMatch(state, 'https://api.github.com/users/x', 'GET')).toBeUndefined();
  });

  it('skips header rules', () => {
    const headerRule: Rule = {
      ...makeMockRule({ id: 'hdr' }),
      action: { kind: 'header', requestHeaders: [], responseHeaders: [] },
    };
    const state = makeState([headerRule]);
    expect(findFirstMockMatch(state, 'https://api.github.com/users/x', 'GET')).toBeUndefined();
  });
});
