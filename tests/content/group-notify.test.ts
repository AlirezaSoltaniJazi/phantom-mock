import { describe, expect, it } from 'vitest';
import { conditionalGroupForHit } from '@/content/group-notify';
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

describe('conditionalGroupForHit', () => {
  it('returns the group when the hit rule belongs to a page-conditional group', () => {
    const g = conditionalGroupForHit(makeState(), 'rule_cond');
    expect(g?.id).toBe('grp_cond');
    expect(g?.name).toBe('Therapy');
  });

  it('returns undefined for a rule in an unconditional group', () => {
    expect(conditionalGroupForHit(makeState(), 'rule_plain')).toBeUndefined();
  });

  it('returns undefined for an unknown rule id', () => {
    expect(conditionalGroupForHit(makeState(), 'nope')).toBeUndefined();
  });
});
