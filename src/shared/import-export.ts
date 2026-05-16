import {
  CURRENT_SCHEMA_VERSION,
  HTTP_METHODS,
  type AppState,
  type ExportBundle,
  type Group,
  type HeaderOp,
  type HttpMethod,
  type ImportStrategy,
  type MockAction,
  type HeaderAction,
  type Result,
  type Rule,
} from './types';
import { MAX_DELAY_MS, MAX_STATUS_CODE, MIN_STATUS_CODE } from './constants';

export function buildExportBundle(state: AppState): ExportBundle {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    groups: state.groups,
    rules: state.rules,
  };
}

export interface ExportSelection {
  groupIds: Set<string>;
  ruleIds: Set<string>;
}

export function buildSelectiveExportBundle(
  state: AppState,
  selection: ExportSelection
): ExportBundle {
  const rules = state.rules.filter((r) => selection.ruleIds.has(r.id));
  const requiredGroupIds = new Set<string>(selection.groupIds);
  for (const r of rules) requiredGroupIds.add(r.groupId);
  const groups = state.groups.filter((g) => requiredGroupIds.has(g.id));
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    groups,
    rules,
  };
}

export function filterBundle(bundle: ExportBundle, selection: ExportSelection): ExportBundle {
  const rules = bundle.rules.filter((r) => selection.ruleIds.has(r.id));
  const requiredGroupIds = new Set<string>(selection.groupIds);
  for (const r of rules) requiredGroupIds.add(r.groupId);
  const groups = bundle.groups.filter((g) => requiredGroupIds.has(g.id));
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: bundle.exportedAt,
    groups,
    rules,
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
  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      groups,
      rules,
    },
  };
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
  if (m.urlMatchType !== 'exact' && m.urlMatchType !== 'contains' && m.urlMatchType !== 'regex') {
    return { ok: false, error: `${path}.urlMatchType must be exact, contains, or regex` };
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
    if (typeof h.name !== 'string' || h.name.length === 0) {
      return { ok: false, error: `${path}[${i}].name must be a non-empty string` };
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
  switch (strategy) {
    case 'replace':
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        masterEnabled: current.masterEnabled,
        groups: bundle.groups,
        rules: bundle.rules,
      };
    case 'merge-by-id': {
      const groupMap = new Map(current.groups.map((g) => [g.id, g]));
      for (const g of bundle.groups) groupMap.set(g.id, g);
      const ruleMap = new Map(current.rules.map((r) => [r.id, r]));
      for (const r of bundle.rules) ruleMap.set(r.id, r);
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        masterEnabled: current.masterEnabled,
        groups: [...groupMap.values()],
        rules: [...ruleMap.values()],
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
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        masterEnabled: current.masterEnabled,
        groups,
        rules,
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
