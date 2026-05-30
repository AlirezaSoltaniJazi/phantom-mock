import { describe, expect, it } from 'vitest';
import { ruleIdFor, translateToDnrRules } from '@/background/rules-dnr';
import { CURRENT_SCHEMA_VERSION, type AppState, type Rule } from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';

function makeHeaderRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule_h',
    name: 'Header rule',
    groupId: DEFAULT_GROUP_ID,
    enabled: true,
    match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/api/' },
    action: {
      kind: 'header',
      requestHeaders: [{ name: 'X-Phantom', op: 'set', value: 'yes' }],
      responseHeaders: [{ name: 'X-Trace', op: 'remove' }],
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
  };
}

describe('translateToDnrRules', () => {
  it('returns empty when master is off', () => {
    expect(translateToDnrRules(makeState([makeHeaderRule()], false))).toEqual([]);
  });

  it('skips disabled rules and rules in disabled groups', () => {
    const state: AppState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      masterEnabled: true,
      groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: false, order: 0 }],
      rules: [makeHeaderRule()],
    };
    expect(translateToDnrRules(state)).toEqual([]);
  });

  it('emits a modifyHeaders rule with the right condition', () => {
    const rules = translateToDnrRules(makeState([makeHeaderRule()]));
    expect(rules).toHaveLength(1);
    const r = rules[0];
    expect(r?.action.type).toBeDefined();
    expect(r?.condition.urlFilter).toBe('/api/');
    expect(r?.condition.resourceTypes).toBeDefined();
  });

  it('uses regexFilter for regex match type', () => {
    const rules = translateToDnrRules(
      makeState([
        makeHeaderRule({
          match: { method: '*', urlMatchType: 'regex', urlPattern: '^https://x\\.com/.+$' },
        }),
      ])
    );
    expect(rules[0]?.condition.regexFilter).toBe('^https://x\\.com/.+$');
    expect(rules[0]?.condition.requestMethods).toBeUndefined();
  });

  it('skips rules with no header ops', () => {
    const r = makeHeaderRule({
      action: { kind: 'header', requestHeaders: [], responseHeaders: [] },
    });
    expect(translateToDnrRules(makeState([r]))).toEqual([]);
  });

  it('produces DNR IDs >= 1 for any rule id, including unlucky hashes', () => {
    // DNR rejects rule IDs < 1 with "id must be >= 1" and discards the whole
    // batch — the regression we are guarding against.
    const samples = [
      '',
      'rule_a',
      'rule_b',
      'rule_c',
      'rule_d',
      'rule_e',
      'rule_f',
      'rule_g',
      'rule_h',
      'rule_i',
      'rule_j',
      'a-very-long-id-that-might-collide-on-modulo-0',
    ];
    for (const id of samples) {
      const rule = makeHeaderRule({ id });
      const dnrId = ruleIdFor(rule);
      expect(dnrId).toBeGreaterThanOrEqual(1);
      expect(dnrId).toBeLessThan(2_147_483_647);
      expect(Number.isInteger(dnrId)).toBe(true);
    }
  });

  it('skips mock rules entirely', () => {
    const mockRule: Rule = {
      id: 'mock_a',
      name: 'mock',
      groupId: DEFAULT_GROUP_ID,
      enabled: true,
      match: { method: '*', urlMatchType: 'contains', urlPattern: '/x' },
      action: {
        kind: 'mock',
        statusCode: 200,
        delayMs: 0,
        responseBody: '{}',
        responseContentType: 'application/json',
        responseHeaders: [],
        logToPanel: false,
      },
    };
    expect(translateToDnrRules(makeState([mockRule]))).toEqual([]);
  });
});
