export const STORAGE_KEYS = {
  APP_STATE: 'phantomMock.appState.v1',
  UI_PREFS: 'phantomMock.uiPrefs.v1',
} as const;

export const MESSAGE_TYPES = {
  GET_STATE: 'GET_STATE',
  MUTATE_STATE: 'MUTATE_STATE',
  RULES_UPDATED: 'RULES_UPDATED',
  MOCK_HIT: 'MOCK_HIT',
  GET_HIT_LOG: 'GET_HIT_LOG',
  CLEAR_HIT_LOG: 'CLEAR_HIT_LOG',
} as const;

export const PORT_NAMES = {
  HIT_LOG: 'phantom-mock.hit-log',
} as const;

export const PAGE_MESSAGE_SOURCE = 'phantom-mock';

export const PAGE_MESSAGE_TYPES = {
  RULES: 'RULES',
  HIT: 'HIT',
} as const;

export const DEFAULT_GROUP_ID = 'default';
export const DEFAULT_GROUP_NAME = 'Default';

export const MAX_RULES = 4000;
export const MAX_HIT_LOG_ENTRIES = 500;
export const MAX_DELAY_MS = 60_000;
export const MIN_STATUS_CODE = 100;
export const MAX_STATUS_CODE = 599;

export const DNR_RULE_ID_OFFSET = 1;
