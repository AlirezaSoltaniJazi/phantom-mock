import { CURRENT_SCHEMA_VERSION, type AppState } from '@/shared/types';
import { DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME, STORAGE_KEYS } from '@/shared/constants';

export function defaultState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled: true,
    groups: [{ id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME, enabled: true, order: 0 }],
    rules: [],
    storageProfiles: [],
  };
}

export async function getState(): Promise<AppState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.APP_STATE);
  const raw = result[STORAGE_KEYS.APP_STATE];
  if (!isAppState(raw)) {
    const initial = defaultState();
    await setState(initial);
    return initial;
  }
  return migrate(raw);
}

export async function setState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.APP_STATE]: state });
}

export async function updateState(updater: (current: AppState) => AppState): Promise<AppState> {
  const current = await getState();
  const next = updater(current);
  await setState(next);
  return next;
}

export function subscribe(listener: (next: AppState) => void): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName
  ): void => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEYS.APP_STATE];
    if (!change) return;
    if (isAppState(change.newValue)) {
      listener(change.newValue);
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

// Soft-migration: additive only. Each new field added to AppState must
// normalize a missing/legacy value here (rather than the legacy `migrate`
// path that wiped state on any schema-version mismatch). Keep CURRENT_SCHEMA_VERSION
// stable for additive changes; bump only when an on-disk shape break is
// genuinely required.
function migrate(raw: AppState): AppState {
  const next: AppState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled: raw.masterEnabled,
    groups: raw.groups,
    rules: raw.rules,
    storageProfiles: Array.isArray(raw.storageProfiles) ? raw.storageProfiles : [],
  };
  return next;
}

// `storageProfiles` is intentionally NOT validated here — it's an additive
// field handled by `migrate` so pre-feature state still loads cleanly.
function isAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.masterEnabled === 'boolean' &&
    Array.isArray(v.groups) &&
    Array.isArray(v.rules)
  );
}
