import { DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME } from './constants';
import { CURRENT_SCHEMA_VERSION, type AppState } from './types';

// The pristine app state: master on, a single empty "Default" group, no rules or
// profiles. Single source of truth for both first-run seeding (background) and
// the Settings "Reset all data" action.
export function defaultAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    masterEnabled: true,
    groups: [{ id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME, enabled: true, order: 0 }],
    rules: [],
    storageProfiles: [],
    cookieProfiles: [],
  };
}
