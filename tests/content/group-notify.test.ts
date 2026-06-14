import { describe, expect, it } from 'vitest';
import { groupForRule } from '@/content/group-notify';
import { CURRENT_SCHEMA_VERSION, type AppState, type Rule } from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';

function makeRule(id: string, groupId: string): Rule {
  return {
    id,
    name: id,
    groupId,
    enabled: true,
    match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/api/' },
    action: {
      kind: 'mock',
      statusCode: 200,
      delayMs: 0,
      responseBody: '{}',
      responseContentType: 'application/json',
      responseHeaders: [],
      logToPanel: true,
    },
  };
}

function makeState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled: true,
    groups: [
      { id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 },
      {
        id: 'grp_cond',
        name: 'Therapy',
        enabled: true,
        order: 1,
        activation: { pageUrlContains: 'therapy-details' },
      },
    ],
    rules: [makeRule('rule_plain', DEFAULT_GROUP_ID), makeRule('rule_cond', 'grp_cond')],
    storageProfiles: [],
    cookieProfiles: [],
  };
}

describe('groupForRule', () => {
  it('returns the owning group for a rule in an unconditional group', () => {
    const g = groupForRule(makeState(), 'rule_plain');
    expect(g?.id).toBe(DEFAULT_GROUP_ID);
    expect(g?.activation?.pageUrlContains).toBeUndefined();
  });

  it('returns the owning group (with its activation) for a conditional-group rule', () => {
    const g = groupForRule(makeState(), 'rule_cond');
    expect(g?.name).toBe('Therapy');
    expect(g?.activation?.pageUrlContains).toBe('therapy-details');
  });

  it('returns undefined for an unknown rule id', () => {
    expect(groupForRule(makeState(), 'nope')).toBeUndefined();
  });
});
