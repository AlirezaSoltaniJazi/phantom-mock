import { describe, expect, it } from 'vitest';
import { applyImport, buildExportBundle, parseExportBundle } from '@/shared/import-export';
import { CURRENT_SCHEMA_VERSION, type AppState, type Rule } from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';

const baseGroup = { id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 };

const baseRule: Rule = {
  id: 'rule_a',
  name: 'A',
  groupId: DEFAULT_GROUP_ID,
  enabled: true,
  match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/x' },
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

const baseState: AppState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  masterEnabled: true,
  groups: [baseGroup],
  rules: [baseRule],
  storageProfiles: [],
  cookieProfiles: [],
};

describe('buildExportBundle / parseExportBundle', () => {
  it('round-trips a state', () => {
    const bundle = buildExportBundle(baseState);
    const json = JSON.stringify(bundle);
    const parsed = parseExportBundle(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.groups).toEqual(baseState.groups);
      expect(parsed.value.rules).toEqual(baseState.rules);
    }
  });

  it('rejects invalid JSON', () => {
    const r = parseExportBundle('{not json}');
    expect(r.ok).toBe(false);
  });

  it('rejects wrong schemaVersion', () => {
    const r = parseExportBundle(JSON.stringify({ schemaVersion: 999, groups: [], rules: [] }));
    expect(r.ok).toBe(false);
  });

  it('rejects rule referencing missing group', () => {
    const bad = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      groups: [],
      rules: [baseRule],
    };
    const r = parseExportBundle(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('groupId');
  });

  it('rejects status code out of range', () => {
    const bad = JSON.parse(JSON.stringify(buildExportBundle(baseState)));
    bad.rules[0].action.statusCode = 999;
    const r = parseExportBundle(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });
});

describe('group activation conditions', () => {
  it('round-trips a group pageUrlContains condition', () => {
    const state: AppState = {
      ...baseState,
      groups: [{ ...baseGroup, activation: { pageUrlContains: '/v2/' } }],
    };
    const parsed = parseExportBundle(JSON.stringify(buildExportBundle(state)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.groups[0]?.activation).toEqual({ pageUrlContains: '/v2/' });
    }
  });

  it('drops an empty pageUrlContains condition on import', () => {
    const bundle = JSON.parse(JSON.stringify(buildExportBundle(baseState)));
    bundle.groups[0].activation = { pageUrlContains: '' };
    const parsed = parseExportBundle(JSON.stringify(bundle));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.groups[0]?.activation).toBeUndefined();
  });

  it('rejects a non-string pageUrlContains', () => {
    const bundle = JSON.parse(JSON.stringify(buildExportBundle(baseState)));
    bundle.groups[0].activation = { pageUrlContains: 123 };
    const parsed = parseExportBundle(JSON.stringify(bundle));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('pageUrlContains');
  });

  it('imports an old bundle that has no activation field', () => {
    const parsed = parseExportBundle(JSON.stringify(buildExportBundle(baseState)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.groups[0]?.activation).toBeUndefined();
  });
});

describe('applyImport', () => {
  it('replace strategy substitutes groups + rules but keeps masterEnabled', () => {
    const incoming = buildExportBundle({
      ...baseState,
      groups: [{ id: 'g2', name: 'Other', enabled: false, order: 0 }],
      rules: [
        {
          ...baseRule,
          id: 'rule_b',
          groupId: 'g2',
        },
      ],
    });
    const next = applyImport({ ...baseState, masterEnabled: false }, incoming, 'replace');
    expect(next.masterEnabled).toBe(false);
    expect(next.groups.map((g) => g.id)).toEqual(['g2']);
    expect(next.rules.map((r) => r.id)).toEqual(['rule_b']);
  });

  it('merge-by-id overwrites duplicates but keeps non-overlapping entries', () => {
    const incoming = buildExportBundle({
      ...baseState,
      rules: [{ ...baseRule, name: 'Updated' }],
    });
    const next = applyImport(baseState, incoming, 'merge-by-id');
    expect(next.rules).toHaveLength(1);
    expect(next.rules[0]?.name).toBe('Updated');
  });

  it('append-as-new creates fresh ids without colliding', () => {
    const incoming = buildExportBundle(baseState);
    const next = applyImport(baseState, incoming, 'append-as-new');
    expect(next.groups).toHaveLength(2);
    expect(next.rules).toHaveLength(2);
    const ids = new Set(next.rules.map((r) => r.id));
    expect(ids.size).toBe(2);
    expect(next.rules[1]?.groupId).not.toBe(baseRule.groupId);
  });
});
