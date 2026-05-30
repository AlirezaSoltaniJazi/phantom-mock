import { describe, expect, it } from 'vitest';
import {
  applyImport,
  applyImportWithResolutions,
  buildExportBundle,
  detectConflicts,
  parseExportBundle,
} from '@/shared/import-export';
import { CURRENT_SCHEMA_VERSION, type AppState, type CookieProfile } from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';

function makeProfile(overrides: Partial<CookieProfile> = {}): CookieProfile {
  return {
    id: 'cprof_a',
    name: 'Language',
    cookieName: 'app_locale',
    values: ['en', 'de'],
    enabled: true,
    ...overrides,
  };
}

function makeState(profiles: CookieProfile[]): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled: true,
    groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
    rules: [],
    storageProfiles: [],
    cookieProfiles: profiles,
  };
}

describe('CookieProfile import/export', () => {
  it('export bundle includes cookie profiles', () => {
    const state = makeState([makeProfile()]);
    const bundle = buildExportBundle(state);
    expect(bundle.cookieProfiles).toHaveLength(1);
    expect(bundle.cookieProfiles?.[0]?.id).toBe('cprof_a');
  });

  it('round-trips path / prefix / suffix when configured', () => {
    const state = makeState([makeProfile({ path: '/api/admin/', prefix: '"', suffix: '"' })]);
    const json = JSON.stringify(buildExportBundle(state));
    const result = parseExportBundle(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cookieProfiles?.[0]?.path).toBe('/api/admin/');
      expect(result.value.cookieProfiles?.[0]?.prefix).toBe('"');
      expect(result.value.cookieProfiles?.[0]?.suffix).toBe('"');
    }
  });

  it('accepts pre-0.5.0 bundles with no cookieProfiles key', () => {
    const legacy = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-05-30T00:00:00.000Z',
      groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
      rules: [],
      // no cookieProfiles
    });
    const result = parseExportBundle(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.cookieProfiles).toEqual([]);
  });

  it('rejects a profile missing cookieName', () => {
    const bad = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-05-30T00:00:00.000Z',
      groups: [{ id: DEFAULT_GROUP_ID, name: 'Default', enabled: true, order: 0 }],
      rules: [],
      cookieProfiles: [{ id: 'cprof_x', name: 'x', values: [], enabled: true }],
    });
    const result = parseExportBundle(bad);
    expect(result.ok).toBe(false);
  });

  it('applyImport merge-by-id merges cookie profiles by id', () => {
    const current = makeState([
      makeProfile({ id: 'cprof_a', name: 'A' }),
      makeProfile({ id: 'cprof_b', name: 'B' }),
    ]);
    const bundle = buildExportBundle(
      makeState([
        makeProfile({ id: 'cprof_b', name: 'B updated' }),
        makeProfile({ id: 'cprof_c', name: 'C' }),
      ])
    );
    const next = applyImport(current, bundle, 'merge-by-id');
    const byId = new Map(next.cookieProfiles.map((p) => [p.id, p]));
    expect(byId.get('cprof_a')?.name).toBe('A');
    expect(byId.get('cprof_b')?.name).toBe('B updated');
    expect(byId.get('cprof_c')?.name).toBe('C');
  });

  it('detectConflicts surfaces colliding cookie profile ids', () => {
    const current = makeState([makeProfile({ id: 'cprof_a' })]);
    const bundle = buildExportBundle(
      makeState([makeProfile({ id: 'cprof_a' }), makeProfile({ id: 'cprof_b' })])
    );
    const conflicts = detectConflicts(current, bundle);
    expect([...conflicts.cookieProfileIds]).toEqual(['cprof_a']);
  });

  it('applyImportWithResolutions overwrites or renames per cookie profile choice', () => {
    const current = makeState([
      makeProfile({ id: 'cprof_a', name: 'Mine' }),
      makeProfile({ id: 'cprof_b', name: 'Other' }),
    ]);
    const bundle = buildExportBundle(
      makeState([
        makeProfile({ id: 'cprof_a', name: 'Theirs' }),
        makeProfile({ id: 'cprof_b', name: 'Other' }),
      ])
    );
    const next = applyImportWithResolutions(current, bundle, {
      rules: new Map(),
      groups: new Map(),
      storageProfiles: new Map(),
      cookieProfiles: new Map([
        ['cprof_a', 'overwrite'],
        ['cprof_b', 'rename'],
      ]),
    });
    expect(next.cookieProfiles.find((p) => p.id === 'cprof_a')?.name).toBe('Theirs');
    const others = next.cookieProfiles.filter((p) => p.name.startsWith('Other'));
    expect(others.length).toBe(2);
    expect(others[1]?.name).toBe('Other (2)');
  });
});
