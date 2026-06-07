import {
  CURRENT_SCHEMA_VERSION,
  HTTP_METHODS,
  type AppState,
  type CookieProfile,
  type ExportBundle,
  type Group,
  type HeaderOp,
  type HttpMethod,
  type ImportStrategy,
  type MockAction,
  type HeaderAction,
  type Result,
  type Rule,
  type StorageProfile,
} from './types';
import { MAX_DELAY_MS, MAX_STATUS_CODE, MIN_STATUS_CODE } from './constants';

export function buildExportBundle(state: AppState): ExportBundle {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    groups: state.groups,
    rules: state.rules,
    storageProfiles: state.storageProfiles,
    cookieProfiles: state.cookieProfiles,
  };
}

export interface ExportSelection {
  groupIds: Set<string>;
  ruleIds: Set<string>;
  storageProfileIds: Set<string>;
  cookieProfileIds: Set<string>;
}

export function buildSelectiveExportBundle(
  state: AppState,
  selection: ExportSelection
): ExportBundle {
  const rules = state.rules.filter((r) => selection.ruleIds.has(r.id));
  const requiredGroupIds = new Set<string>(selection.groupIds);
  for (const r of rules) requiredGroupIds.add(r.groupId);
  const groups = state.groups.filter((g) => requiredGroupIds.has(g.id));
  const storageProfiles = state.storageProfiles.filter((p) =>
    selection.storageProfileIds.has(p.id)
  );
  const cookieProfiles = state.cookieProfiles.filter((p) => selection.cookieProfileIds.has(p.id));
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    groups,
    rules,
    storageProfiles,
    cookieProfiles,
  };
}

export function filterBundle(bundle: ExportBundle, selection: ExportSelection): ExportBundle {
  const rules = bundle.rules.filter((r) => selection.ruleIds.has(r.id));
  const requiredGroupIds = new Set<string>(selection.groupIds);
  for (const r of rules) requiredGroupIds.add(r.groupId);
  const groups = bundle.groups.filter((g) => requiredGroupIds.has(g.id));
  const storageProfiles = (bundle.storageProfiles ?? []).filter((p) =>
    selection.storageProfileIds.has(p.id)
  );
  const cookieProfiles = (bundle.cookieProfiles ?? []).filter((p) =>
    selection.cookieProfileIds.has(p.id)
  );
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: bundle.exportedAt,
    groups,
    rules,
    storageProfiles,
    cookieProfiles,
  };
}

export function parseExportBundle(raw: string): Result<ExportBundle> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `Not valid JSON: ${(err as Error).message}` };
  }
  return validateBundle(parsed);
}

export function validateBundle(value: unknown): Result<ExportBundle> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: 'Expected an object at top level' };
  }
  const obj = value as Record<string, unknown>;
  if (obj.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schemaVersion: expected ${CURRENT_SCHEMA_VERSION}, got ${String(obj.schemaVersion)}`,
    };
  }
  if (!Array.isArray(obj.groups)) {
    return { ok: false, error: '`groups` must be an array' };
  }
  if (!Array.isArray(obj.rules)) {
    return { ok: false, error: '`rules` must be an array' };
  }
  const groups: Group[] = [];
  for (let i = 0; i < obj.groups.length; i++) {
    const r = validateGroup(obj.groups[i], i);
    if (!r.ok) return r;
    groups.push(r.value);
  }
  const groupIds = new Set(groups.map((g) => g.id));
  const rules: Rule[] = [];
  for (let i = 0; i < obj.rules.length; i++) {
    const r = validateRule(obj.rules[i], i, groupIds);
    if (!r.ok) return r;
    rules.push(r.value);
  }
  // `storageProfiles` is optional in bundles for backward compatibility with
  // pre-0.4.0 exports. Validate when present, otherwise default to [].
  const storageProfiles: StorageProfile[] = [];
  if (obj.storageProfiles !== undefined) {
    if (!Array.isArray(obj.storageProfiles)) {
      return { ok: false, error: '`storageProfiles` must be an array' };
    }
    for (let i = 0; i < obj.storageProfiles.length; i++) {
      const r = validateStorageProfile(obj.storageProfiles[i], i);
      if (!r.ok) return r;
      storageProfiles.push(r.value);
    }
  }
  // `cookieProfiles` is optional in bundles for backward compatibility with
  // pre-0.5.0 exports. Validate when present, otherwise default to [].
  const cookieProfiles: CookieProfile[] = [];
  if (obj.cookieProfiles !== undefined) {
    if (!Array.isArray(obj.cookieProfiles)) {
      return { ok: false, error: '`cookieProfiles` must be an array' };
    }
    for (let i = 0; i < obj.cookieProfiles.length; i++) {
      const r = validateCookieProfile(obj.cookieProfiles[i], i);
      if (!r.ok) return r;
      cookieProfiles.push(r.value);
    }
  }
  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      groups,
      rules,
      storageProfiles,
      cookieProfiles,
    },
  };
}

function validateStorageProfile(value: unknown, index: number): Result<StorageProfile> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: `storageProfiles[${index}] must be an object` };
  }
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0) {
    return { ok: false, error: `storageProfiles[${index}].id must be a non-empty string` };
  }
  if (typeof p.name !== 'string') {
    return { ok: false, error: `storageProfiles[${index}].name must be a string` };
  }
  if (typeof p.key !== 'string' || p.key.length === 0) {
    return { ok: false, error: `storageProfiles[${index}].key must be a non-empty string` };
  }
  if (typeof p.enabled !== 'boolean') {
    return { ok: false, error: `storageProfiles[${index}].enabled must be a boolean` };
  }
  if (!Array.isArray(p.values)) {
    return { ok: false, error: `storageProfiles[${index}].values must be an array` };
  }
  const values: string[] = [];
  for (let i = 0; i < p.values.length; i++) {
    const v = p.values[i];
    if (typeof v !== 'string') {
      return { ok: false, error: `storageProfiles[${index}].values[${i}] must be a string` };
    }
    values.push(v);
  }
  const profile: StorageProfile = {
    id: p.id,
    name: p.name,
    key: p.key,
    values,
    enabled: p.enabled,
  };
  if (typeof p.prefix === 'string') profile.prefix = p.prefix;
  else if (p.prefix !== undefined) {
    return { ok: false, error: `storageProfiles[${index}].prefix must be a string` };
  }
  if (typeof p.suffix === 'string') profile.suffix = p.suffix;
  else if (p.suffix !== undefined) {
    return { ok: false, error: `storageProfiles[${index}].suffix must be a string` };
  }
  return { ok: true, value: profile };
}

function validateCookieProfile(value: unknown, index: number): Result<CookieProfile> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: `cookieProfiles[${index}] must be an object` };
  }
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0) {
    return { ok: false, error: `cookieProfiles[${index}].id must be a non-empty string` };
  }
  if (typeof p.name !== 'string') {
    return { ok: false, error: `cookieProfiles[${index}].name must be a string` };
  }
  if (typeof p.cookieName !== 'string' || p.cookieName.length === 0) {
    return {
      ok: false,
      error: `cookieProfiles[${index}].cookieName must be a non-empty string`,
    };
  }
  if (typeof p.enabled !== 'boolean') {
    return { ok: false, error: `cookieProfiles[${index}].enabled must be a boolean` };
  }
  if (!Array.isArray(p.values)) {
    return { ok: false, error: `cookieProfiles[${index}].values must be an array` };
  }
  const values: string[] = [];
  for (let i = 0; i < p.values.length; i++) {
    const v = p.values[i];
    if (typeof v !== 'string') {
      return { ok: false, error: `cookieProfiles[${index}].values[${i}] must be a string` };
    }
    values.push(v);
  }
  const profile: CookieProfile = {
    id: p.id,
    name: p.name,
    cookieName: p.cookieName,
    values,
    enabled: p.enabled,
  };
  if (typeof p.path === 'string') profile.path = p.path;
  else if (p.path !== undefined) {
    return { ok: false, error: `cookieProfiles[${index}].path must be a string` };
  }
  if (typeof p.prefix === 'string') profile.prefix = p.prefix;
  else if (p.prefix !== undefined) {
    return { ok: false, error: `cookieProfiles[${index}].prefix must be a string` };
  }
  if (typeof p.suffix === 'string') profile.suffix = p.suffix;
  else if (p.suffix !== undefined) {
    return { ok: false, error: `cookieProfiles[${index}].suffix must be a string` };
  }
  return { ok: true, value: profile };
}

function validateGroup(value: unknown, index: number): Result<Group> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: `groups[${index}] must be an object` };
  }
  const g = value as Record<string, unknown>;
  if (typeof g.id !== 'string' || g.id.length === 0) {
    return { ok: false, error: `groups[${index}].id must be a non-empty string` };
  }
  if (typeof g.name !== 'string') {
    return { ok: false, error: `groups[${index}].name must be a string` };
  }
  if (typeof g.enabled !== 'boolean') {
    return { ok: false, error: `groups[${index}].enabled must be a boolean` };
  }
  const order = typeof g.order === 'number' ? g.order : index;
  return { ok: true, value: { id: g.id, name: g.name, enabled: g.enabled, order } };
}

function validateRule(value: unknown, index: number, groupIds: Set<string>): Result<Rule> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: `rules[${index}] must be an object` };
  }
  const r = value as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) {
    return { ok: false, error: `rules[${index}].id must be a non-empty string` };
  }
  if (typeof r.name !== 'string') {
    return { ok: false, error: `rules[${index}].name must be a string` };
  }
  if (typeof r.enabled !== 'boolean') {
    return { ok: false, error: `rules[${index}].enabled must be a boolean` };
  }
  if (typeof r.groupId !== 'string' || !groupIds.has(r.groupId)) {
    return {
      ok: false,
      error: `rules[${index}].groupId must reference an existing group (got ${String(r.groupId)})`,
    };
  }
  const matchResult = validateMatch(r.match, `rules[${index}].match`);
  if (!matchResult.ok) return matchResult;
  const actionResult = validateAction(r.action, `rules[${index}].action`);
  if (!actionResult.ok) return actionResult;
  return {
    ok: true,
    value: {
      id: r.id,
      name: r.name,
      groupId: r.groupId,
      enabled: r.enabled,
      match: matchResult.value,
      action: actionResult.value,
    },
  };
}

function validateMatch(value: unknown, path: string): Result<Rule['match']> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: `${path} must be an object` };
  }
  const m = value as Record<string, unknown>;
  if (typeof m.method !== 'string' || !HTTP_METHODS.includes(m.method as HttpMethod)) {
    return {
      ok: false,
      error: `${path}.method must be one of ${HTTP_METHODS.join(', ')}`,
    };
  }
  if (
    m.urlMatchType !== 'exact' &&
    m.urlMatchType !== 'contains' &&
    m.urlMatchType !== 'regex' &&
    m.urlMatchType !== 'template'
  ) {
    return {
      ok: false,
      error: `${path}.urlMatchType must be exact, contains, regex, or template`,
    };
  }
  if (typeof m.urlPattern !== 'string') {
    return { ok: false, error: `${path}.urlPattern must be a string` };
  }
  return {
    ok: true,
    value: {
      method: m.method as HttpMethod,
      urlMatchType: m.urlMatchType,
      urlPattern: m.urlPattern,
    },
  };
}

function validateAction(value: unknown, path: string): Result<Rule['action']> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: `${path} must be an object` };
  }
  const a = value as Record<string, unknown>;
  if (a.kind === 'mock') return validateMockAction(a, path);
  if (a.kind === 'header') return validateHeaderAction(a, path);
  return { ok: false, error: `${path}.kind must be 'mock' or 'header'` };
}

function validateMockAction(a: Record<string, unknown>, path: string): Result<MockAction> {
  if (
    typeof a.statusCode !== 'number' ||
    a.statusCode < MIN_STATUS_CODE ||
    a.statusCode > MAX_STATUS_CODE
  ) {
    return {
      ok: false,
      error: `${path}.statusCode must be a number between ${MIN_STATUS_CODE} and ${MAX_STATUS_CODE}`,
    };
  }
  if (typeof a.delayMs !== 'number' || a.delayMs < 0 || a.delayMs > MAX_DELAY_MS) {
    return {
      ok: false,
      error: `${path}.delayMs must be a number between 0 and ${MAX_DELAY_MS}`,
    };
  }
  if (typeof a.responseBody !== 'string') {
    return { ok: false, error: `${path}.responseBody must be a string` };
  }
  if (typeof a.responseContentType !== 'string') {
    return { ok: false, error: `${path}.responseContentType must be a string` };
  }
  if (typeof a.logToPanel !== 'boolean') {
    return { ok: false, error: `${path}.logToPanel must be a boolean` };
  }
  const headersResult = validateHeaderOps(a.responseHeaders ?? [], `${path}.responseHeaders`);
  if (!headersResult.ok) return headersResult;
  return {
    ok: true,
    value: {
      kind: 'mock',
      statusCode: a.statusCode,
      delayMs: a.delayMs,
      responseBody: a.responseBody,
      responseContentType: a.responseContentType,
      responseHeaders: headersResult.value,
      logToPanel: a.logToPanel,
    },
  };
}

function validateHeaderAction(a: Record<string, unknown>, path: string): Result<HeaderAction> {
  const req = validateHeaderOps(a.requestHeaders ?? [], `${path}.requestHeaders`);
  if (!req.ok) return req;
  const res = validateHeaderOps(a.responseHeaders ?? [], `${path}.responseHeaders`);
  if (!res.ok) return res;
  return {
    ok: true,
    value: { kind: 'header', requestHeaders: req.value, responseHeaders: res.value },
  };
}

function validateHeaderOps(value: unknown, path: string): Result<HeaderOp[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: `${path} must be an array` };
  }
  const out: HeaderOp[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: `${path}[${i}] must be an object` };
    }
    const h = item as Record<string, unknown>;
    // Half-filled header rows (empty name) may exist in older exports because
    // the editor used to allow saving them. Silently drop them rather than
    // failing the whole import — mirrors the editor's strip-on-save behaviour.
    if (typeof h.name !== 'string' || h.name.trim().length === 0) {
      continue;
    }
    if (h.op !== 'set' && h.op !== 'append' && h.op !== 'remove') {
      return { ok: false, error: `${path}[${i}].op must be set, append, or remove` };
    }
    if (h.op !== 'remove' && typeof h.value !== 'string') {
      return { ok: false, error: `${path}[${i}].value is required for set/append` };
    }
    out.push({
      name: h.name,
      op: h.op,
      ...(h.op !== 'remove' ? { value: h.value as string } : {}),
    });
  }
  return { ok: true, value: out };
}

export function applyImport(
  current: AppState,
  bundle: ExportBundle,
  strategy: ImportStrategy
): AppState {
  const bundleProfiles = bundle.storageProfiles ?? [];
  const bundleCookieProfiles = bundle.cookieProfiles ?? [];
  switch (strategy) {
    case 'replace':
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        masterEnabled: current.masterEnabled,
        groups: bundle.groups,
        rules: bundle.rules,
        storageProfiles: bundleProfiles,
        cookieProfiles: bundleCookieProfiles,
      };
    case 'merge-by-id': {
      const groupMap = new Map(current.groups.map((g) => [g.id, g]));
      for (const g of bundle.groups) groupMap.set(g.id, g);
      const ruleMap = new Map(current.rules.map((r) => [r.id, r]));
      for (const r of bundle.rules) ruleMap.set(r.id, r);
      const profileMap = new Map(current.storageProfiles.map((p) => [p.id, p]));
      for (const p of bundleProfiles) profileMap.set(p.id, p);
      const cookieMap = new Map(current.cookieProfiles.map((p) => [p.id, p]));
      for (const p of bundleCookieProfiles) cookieMap.set(p.id, p);
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        masterEnabled: current.masterEnabled,
        groups: [...groupMap.values()],
        rules: [...ruleMap.values()],
        storageProfiles: [...profileMap.values()],
        cookieProfiles: [...cookieMap.values()],
      };
    }
    case 'append-as-new': {
      const groupIdMap = new Map<string, string>();
      const groups = [...current.groups];
      for (const g of bundle.groups) {
        const newId = generateId('grp');
        groupIdMap.set(g.id, newId);
        groups.push({ ...g, id: newId, order: groups.length });
      }
      const rules = [...current.rules];
      for (const r of bundle.rules) {
        const newGroupId = groupIdMap.get(r.groupId) ?? r.groupId;
        rules.push({ ...r, id: generateId('rule'), groupId: newGroupId });
      }
      const storageProfiles = [...current.storageProfiles];
      for (const p of bundleProfiles) {
        storageProfiles.push({ ...p, id: generateId('sprof') });
      }
      const cookieProfiles = [...current.cookieProfiles];
      for (const p of bundleCookieProfiles) {
        cookieProfiles.push({ ...p, id: generateId('cprof') });
      }
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        masterEnabled: current.masterEnabled,
        groups,
        rules,
        storageProfiles,
        cookieProfiles,
      };
    }
  }
}

function generateId(prefix: string): string {
  const cryptoLike = globalThis.crypto;
  const suffix =
    cryptoLike && typeof cryptoLike.randomUUID === 'function'
      ? cryptoLike.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${suffix}`;
}

// ── Per-conflict resolution import ────────────────────────────────────────

export type ConflictResolution = 'overwrite' | 'rename';

export interface ImportConflicts {
  ruleIds: Set<string>;
  groupIds: Set<string>;
  storageProfileIds: Set<string>;
  cookieProfileIds: Set<string>;
}

export interface ImportResolutions {
  rules: Map<string, ConflictResolution>;
  groups: Map<string, ConflictResolution>;
  storageProfiles: Map<string, ConflictResolution>;
  cookieProfiles: Map<string, ConflictResolution>;
}

export function detectConflicts(current: AppState, bundle: ExportBundle): ImportConflicts {
  const currentRuleIds = new Set(current.rules.map((r) => r.id));
  const currentGroupIds = new Set(current.groups.map((g) => g.id));
  const currentProfileIds = new Set(current.storageProfiles.map((p) => p.id));
  const currentCookieProfileIds = new Set(current.cookieProfiles.map((p) => p.id));
  const bundleProfiles = bundle.storageProfiles ?? [];
  const bundleCookieProfiles = bundle.cookieProfiles ?? [];
  return {
    ruleIds: new Set(bundle.rules.filter((r) => currentRuleIds.has(r.id)).map((r) => r.id)),
    groupIds: new Set(bundle.groups.filter((g) => currentGroupIds.has(g.id)).map((g) => g.id)),
    storageProfileIds: new Set(
      bundleProfiles.filter((p) => currentProfileIds.has(p.id)).map((p) => p.id)
    ),
    cookieProfileIds: new Set(
      bundleCookieProfiles.filter((p) => currentCookieProfileIds.has(p.id)).map((p) => p.id)
    ),
  };
}

/** Pick a non-conflicting name by appending `(2)`, `(3)`, ... */
function uniqueName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) return baseName;
  let n = 2;
  while (existingNames.has(`${baseName} (${n})`)) n++;
  return `${baseName} (${n})`;
}

/**
 * Import each item from the bundle.
 *
 * - Groups whose `id` already exists are kept as-is — the import never
 *   touches the user's existing group metadata (name / enabled / order).
 *   Imported rules land inside the existing group of the matching id.
 * - Groups whose `id` is new get added.
 * - Rules whose `id` already exists get the resolution from
 *   `resolutions.rules`: `overwrite` (replace by id, default) or `rename`
 *   (keep the existing rule, add the imported one with a fresh `id` and an
 *   auto-suffixed name).
 * - Rules whose `id` is new get added directly.
 */
export function applyImportWithResolutions(
  current: AppState,
  bundle: ExportBundle,
  resolutions: ImportResolutions
): AppState {
  const groupMap = new Map(current.groups.map((g) => [g.id, g]));

  for (const g of bundle.groups) {
    if (groupMap.has(g.id)) continue; // existing group wins — no prompt, no overwrite
    groupMap.set(g.id, g);
  }

  const ruleMap = new Map(current.rules.map((r) => [r.id, r]));
  const ruleNames = new Set(current.rules.map((r) => r.name));

  for (const r of bundle.rules) {
    const conflicts = ruleMap.has(r.id);
    const resolution = resolutions.rules.get(r.id) ?? 'overwrite';
    if (!conflicts || resolution === 'overwrite') {
      ruleMap.set(r.id, r);
      ruleNames.add(r.name);
      continue;
    }
    // rename-as-new
    const newId = generateId('rule');
    const newName = uniqueName(r.name, ruleNames);
    ruleMap.set(newId, { ...r, id: newId, name: newName });
    ruleNames.add(newName);
  }

  const profileMap = new Map(current.storageProfiles.map((p) => [p.id, p]));
  const profileNames = new Set(current.storageProfiles.map((p) => p.name));
  for (const p of bundle.storageProfiles ?? []) {
    const conflicts = profileMap.has(p.id);
    const resolution = resolutions.storageProfiles.get(p.id) ?? 'overwrite';
    if (!conflicts || resolution === 'overwrite') {
      profileMap.set(p.id, p);
      profileNames.add(p.name);
      continue;
    }
    const newId = generateId('sprof');
    const newName = uniqueName(p.name, profileNames);
    profileMap.set(newId, { ...p, id: newId, name: newName });
    profileNames.add(newName);
  }

  const cookieMap = new Map(current.cookieProfiles.map((p) => [p.id, p]));
  const cookieNames = new Set(current.cookieProfiles.map((p) => p.name));
  for (const p of bundle.cookieProfiles ?? []) {
    const conflicts = cookieMap.has(p.id);
    const resolution = resolutions.cookieProfiles.get(p.id) ?? 'overwrite';
    if (!conflicts || resolution === 'overwrite') {
      cookieMap.set(p.id, p);
      cookieNames.add(p.name);
      continue;
    }
    const newId = generateId('cprof');
    const newName = uniqueName(p.name, cookieNames);
    cookieMap.set(newId, { ...p, id: newId, name: newName });
    cookieNames.add(newName);
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled: current.masterEnabled,
    groups: [...groupMap.values()],
    rules: [...ruleMap.values()],
    storageProfiles: [...profileMap.values()],
    cookieProfiles: [...cookieMap.values()],
  };
}
