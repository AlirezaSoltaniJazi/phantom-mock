import { describe, expect, it } from 'vitest';
import {
  applyImport,
  applyImportWithResolutions,
  buildExportBundle,
  detectConflicts,
  parseExportBundle,
} from '@/shared/import-export';
import { CURRENT_SCHEMA_VERSION, type AppState, type StorageProfile } from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';

function makeProfile(overrides: Partial<StorageProfile> = {}): StorageProfile {
  return {
    id: 'sprof_a',
    name: 'Preferred locale',
    key: 'HumaCraftStoreItem__preferredLocale',
    values: ['en_GB', 'de_DE'],
    enabled: true,
    ...overrides,
  };
}

function makeState(profiles: StorageProfile[]): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled: true,
    groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
    rules: [],
    storageProfiles: profiles,
    cookieProfiles: [],
  };
}

describe('StorageProfile import/export', () => {
  it('export bundle includes profiles', () => {
    const state = makeState([makeProfile()]);
    const bundle = buildExportBundle(state);
    expect(bundle.storageProfiles).toHaveLength(1);
    expect(bundle.storageProfiles?.[0]?.id).toBe('sprof_a');
  });

  it('round-trips profiles with prefix and suffix', () => {
    const state = makeState([makeProfile({ prefix: '"', suffix: '"' })]);
    const json = JSON.stringify(buildExportBundle(state));
    const result = parseExportBundle(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.storageProfiles?.[0]?.prefix).toBe('"');
      expect(result.value.storageProfiles?.[0]?.suffix).toBe('"');
    }
  });

  it('omits prefix/suffix when they are not configured', () => {
    const state = makeState([makeProfile()]); // no prefix/suffix
    const bundle = buildExportBundle(state);
    const p = bundle.storageProfiles?.[0];
    expect(p?.prefix).toBeUndefined();
    expect(p?.suffix).toBeUndefined();
  });

  it('rejects a non-string prefix/suffix', () => {
    const bad = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-05-30T00:00:00.000Z',
      groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
      rules: [],
      storageProfiles: [
        {
          id: 'sprof_x',
          name: 'x',
          key: 'k',
          values: ['v'],
          enabled: true,
          prefix: 42,
        },
      ],
    });
    const result = parseExportBundle(bad);
    expect(result.ok).toBe(false);
  });

  it('parseExportBundle round-trips profiles', () => {
    const state = makeState([makeProfile()]);
    const json = JSON.stringify(buildExportBundle(state));
    const result = parseExportBundle(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.storageProfiles).toHaveLength(1);
      expect(result.value.storageProfiles?.[0]?.values).toEqual(['en_GB', 'de_DE']);
    }
  });

  it('parseExportBundle accepts a bundle without storageProfiles (pre-0.4.0)', () => {
    const legacy = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-05-29T00:00:00.000Z',
      groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
      rules: [],
      // no storageProfiles key
    });
    const result = parseExportBundle(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.storageProfiles).toEqual([]);
    }
  });

  it('rejects a profile missing required fields', () => {
    const bad = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-05-29T00:00:00.000Z',
      groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
      rules: [],
      storageProfiles: [{ id: '', name: 'x', key: 'y', values: [], enabled: true }],
    });
    const result = parseExportBundle(bad);
    expect(result.ok).toBe(false);
  });

  it('applyImport replace overwrites profiles', () => {
    const current = makeState([makeProfile({ id: 'sprof_old', name: 'Old' })]);
    const bundle = buildExportBundle(makeState([makeProfile({ id: 'sprof_new', name: 'New' })]));
    const next = applyImport(current, bundle, 'replace');
    expect(next.storageProfiles.map((p) => p.id)).toEqual(['sprof_new']);
  });

  it('applyImport merge-by-id merges profiles by id', () => {
    const current = makeState([
      makeProfile({ id: 'sprof_a', name: 'A' }),
      makeProfile({ id: 'sprof_b', name: 'B' }),
    ]);
    const bundle = buildExportBundle(
      makeState([
        makeProfile({ id: 'sprof_b', name: 'B updated' }),
        makeProfile({ id: 'sprof_c', name: 'C' }),
      ])
    );
    const next = applyImport(current, bundle, 'merge-by-id');
    const byId = new Map(next.storageProfiles.map((p) => [p.id, p]));
    expect(byId.get('sprof_a')?.name).toBe('A');
    expect(byId.get('sprof_b')?.name).toBe('B updated');
    expect(byId.get('sprof_c')?.name).toBe('C');
  });

  it('applyImport append-as-new gives every profile a fresh id', () => {
    const current = makeState([makeProfile({ id: 'sprof_a' })]);
    const bundle = buildExportBundle(makeState([makeProfile({ id: 'sprof_a' })]));
    const next = applyImport(current, bundle, 'append-as-new');
    expect(next.storageProfiles).toHaveLength(2);
    const ids = next.storageProfiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('detectConflicts surfaces colliding profile ids', () => {
    const current = makeState([makeProfile({ id: 'sprof_a' })]);
    const bundle = buildExportBundle(
      makeState([makeProfile({ id: 'sprof_a' }), makeProfile({ id: 'sprof_b' })])
    );
    const conflicts = detectConflicts(current, bundle);
    expect([...conflicts.storageProfileIds]).toEqual(['sprof_a']);
  });

  it('applyImportWithResolutions overwrites by default and renames on choice', () => {
    const current = makeState([
      makeProfile({ id: 'sprof_a', name: 'Mine' }),
      makeProfile({ id: 'sprof_b', name: 'Other' }),
    ]);
    const bundle = buildExportBundle(
      makeState([
        makeProfile({ id: 'sprof_a', name: 'Theirs' }),
        makeProfile({ id: 'sprof_b', name: 'Other' }),
      ])
    );
    const next = applyImportWithResolutions(current, bundle, {
      rules: new Map(),
      groups: new Map(),
      cookieProfiles: new Map(),
      storageProfiles: new Map([
        ['sprof_a', 'overwrite'],
        ['sprof_b', 'rename'],
      ]),
    });
    const sprofA = next.storageProfiles.find((p) => p.id === 'sprof_a');
    expect(sprofA?.name).toBe('Theirs');
    // 'sprof_b' kept its original; the imported one was renamed to a new id.
    const others = next.storageProfiles.filter((p) => p.name.startsWith('Other'));
    expect(others.length).toBe(2);
    expect(others[1]?.name).toBe('Other (2)');
  });
});
