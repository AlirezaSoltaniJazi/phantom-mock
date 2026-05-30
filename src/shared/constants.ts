export const STORAGE_KEYS = {
  APP_STATE: 'phantomMock.appState.v1',
  UI_PREFS: 'phantomMock.uiPrefs.v1',
  // session-area keys — cleared when the browser session ends
  CAPTURE_BUFFER: 'phantomMock.captureBuffer.v1',
  CAPTURE_RECORDING: 'phantomMock.captureRecording.v1',
} as const;

export const MESSAGE_TYPES = {
  GET_STATE: 'GET_STATE',
  MUTATE_STATE: 'MUTATE_STATE',
  RULES_UPDATED: 'RULES_UPDATED',
  MOCK_HIT: 'MOCK_HIT',
  GET_HIT_LOG: 'GET_HIT_LOG',
  CLEAR_HIT_LOG: 'CLEAR_HIT_LOG',
  GET_DNR_DEBUG: 'GET_DNR_DEBUG',
  TEST_DNR_MATCH: 'TEST_DNR_MATCH',
  CLEAR_DNR_MATCH_LOG: 'CLEAR_DNR_MATCH_LOG',
  COOKIES_GET: 'COOKIES_GET',
  COOKIES_SET: 'COOKIES_SET',
  COOKIES_REMOVE: 'COOKIES_REMOVE',
} as const;

export const PORT_NAMES = {
  HIT_LOG: 'phantom-mock.hit-log',
  DNR_MATCH_LOG: 'phantom-mock.dnr-match-log',
} as const;

export const PAGE_MESSAGE_SOURCE = 'phantom-mock';

export const PAGE_MESSAGE_TYPES = {
  RULES: 'RULES',
  HIT: 'HIT',
} as const;

export const DEFAULT_GROUP_ID = 'default';
export const DEFAULT_GROUP_NAME = 'Default';

export const MAX_RULES = 4000;
export const MAX_STORAGE_PROFILES = 200;
export const MAX_COOKIE_PROFILES = 200;
export const MAX_HIT_LOG_ENTRIES = 500;
export const MAX_DNR_MATCH_ENTRIES = 200;
export const MAX_DELAY_MS = 60_000;
export const MIN_STATUS_CODE = 100;
export const MAX_STATUS_CODE = 599;

export const DNR_RULE_ID_OFFSET = 1;
