# Modules

Source-map of every module in the project. Use this to find the right file to read first for any given concern.

## Background (Service Worker)

### `background/service-worker.ts`

- **Purpose**: Main service worker — handles Chrome runtime messages, applies state mutations, broadcasts rule updates to all tabs
- **Entry point**: `chrome.runtime.onMessage` listener, `chrome.runtime.onInstalled` listener
- **Calls**: `background/storage.ts`, `background/rules-dnr.ts`, `background/log.ts`, `background/dnr-match-log.ts`, `background/cookies.ts`, `shared/groups.ts`
- **Called by**: DevTools panel, popup, content scripts (via Chrome messaging)

### `background/storage.ts`

- **Purpose**: Chrome storage wrapper — persists `AppState` to `chrome.storage.local`, provides reactive subscriptions
- **Entry point**: `getState()`, `setState()`, `updateState()`, `subscribe()`, `defaultState()`
- **Calls**: `shared/types.ts`, `shared/constants.ts`, `shared/default-state.ts`
- **Called by**: `background/service-worker.ts`

### `background/rules-dnr.ts`

- **Purpose**: Translates header-type rules to Chrome `declarativeNetRequest` dynamic rules
- **Entry point**: `syncDnrRules()`, `translateToDnrRules()`, `ruleIdFor()`
- **Calls**: `shared/matcher.ts`, `shared/template.ts`, `utils/id.ts`
- **Called by**: `background/service-worker.ts` (via storage subscriber), `background/dnr-match-log.ts`

### `background/log.ts`

- **Purpose**: In-memory hit log buffer with port-based pub/sub to DevTools
- **Entry point**: `recordHit()`, `getHits()`, `clearHits()`, `registerLogPortListener()`
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `background/service-worker.ts`

### `background/dnr-match-log.ts`

- **Purpose**: In-memory ring buffer of real DNR rule matches (from `chrome.declarativeNetRequest.onRuleMatchedDebug`), with port-based pub/sub to the Debug tab
- **Entry point**: `recordDnrMatch()`, `getDnrMatches()`, `clearDnrMatches()`, `registerDnrMatchPortListener()`, `registerDnrMatchListener()`
- **Calls**: `background/storage.ts`, `background/rules-dnr.ts`, `shared/constants.ts`
- **Called by**: `background/service-worker.ts`

### `background/cookies.ts`

- **Purpose**: Origin-scoped `chrome.cookies` get/set/remove, resolving the inspected tab's URL so Chrome derives domain/secure/sameSite
- **Entry point**: `getCookie()`, `setCookie()`, `removeCookie()`, `resolveTabUrl()`
- **Calls**: None (wraps `chrome.cookies` and `chrome.tabs` directly)
- **Called by**: `background/service-worker.ts`

## Content Script

### `content/index.ts`

- **Purpose**: Bridges page world and service worker — relays rules to page injection, forwards hit events back to background, manages toast display
- **Entry point**: Self-executing on `document_start` (isolated world)
- **Calls**: `shared/messages.ts`, `shared/prefs.ts`, `content/toast.ts`, `content/group-notify.ts`, `content/runtime.ts`
- **Called by**: Service worker (via `chrome.tabs.sendMessage`)

### `content/toast.ts`

- **Purpose**: Shadow-DOM toast notifications shown when a mock rule is applied, or when a page-URL-conditional group activates
- **Entry point**: `showRuleAppliedToast(ruleName, groupName?)`, `showGroupActivatedToast(groupName)`
- **Calls**: None
- **Called by**: `content/index.ts`

### `content/group-notify.ts`

- **Purpose**: Looks up the group a hit's rule belongs to, so toasts can be labeled with their group and page-URL-conditional groups can be detected
- **Entry point**: `groupForRule(state, ruleId)`
- **Calls**: `shared/types.ts`
- **Called by**: `content/index.ts`

### `content/runtime.ts`

- **Purpose**: Guards against "Extension context invalidated" errors after the extension is reloaded/updated/disabled — checks context validity and sends fire-and-forget runtime messages that never throw
- **Entry point**: `isExtensionContextValid()`, `sendRuntimeMessage()`
- **Calls**: `shared/messages.ts`
- **Called by**: `content/index.ts`

## Page Injection

### `injected/page-mock.ts`

- **Purpose**: Patches `window.fetch` and `XMLHttpRequest` in MAIN world to intercept requests and return mock responses
- **Entry point**: Self-executing on `document_start` (MAIN world); `setRulesCacheForTest()` for tests
- **Calls**: `shared/matcher.ts`, `shared/constants.ts`
- **Called by**: Content script (receives rules via `window.postMessage`)

## DevTools Panel

### `devtools/devtools.ts`

- **Purpose**: DevTools page script — registers the "Phantom Mock" panel, captures HAR entries from `chrome.devtools.network`, writes capture buffer to session storage
- **Entry point**: `chrome.devtools.panels.create()`, `chrome.devtools.network.onRequestFinished` listener
- **Calls**: `shared/constants.ts`, `utils/id.ts`
- **Called by**: None (entry point)

### `devtools/panel.tsx`

- **Purpose**: Main DevTools React app — tab-based interface (Rules, Groups, Editor, Storage, Storage Editor, Cookies, Cookies Editor, Hit Log, Debug, Capture, Settings), manages editing state and font size
- **Entry point**: `App` component rendered into `panel.html`
- **Calls**: `devtools/state-hook.ts`, all `devtools/components/*`, `devtools/capture/*`, `shared/use-prefs.ts`, `shared/url-parts.ts`
- **Called by**: `panel.html`

### `devtools/state-hook.ts`

- **Purpose**: React hook that fetches `AppState` from the service worker and dispatches mutations
- **Entry point**: `useAppState()` hook
- **Calls**: `shared/messages.ts`, `shared/constants.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/inspected-window.ts`

- **Purpose**: Promise wrapper around `chrome.devtools.inspectedWindow.*` — reads/writes `localStorage` on the inspected page, reloads it
- **Entry point**: `getLocalStorage()`, `setLocalStorage()`, `removeLocalStorage()`, `reloadInspectedPage()`, `hasInspectedWindow()`
- **Calls**: None
- **Called by**: `devtools/components/StorageTab.tsx`, `devtools/components/CookiesTab.tsx`

### `devtools/cookies.ts`

- **Purpose**: Panel-side wrapper that sends `COOKIES_GET`/`COOKIES_SET`/`COOKIES_REMOVE` runtime messages to the service worker for the inspected tab
- **Entry point**: `getCookieValue()`, `setCookieValue()`, `removeCookie()`, `hasCookiesAPI()`, `getInspectedTabId()`
- **Calls**: `shared/messages.ts`, `shared/constants.ts`
- **Called by**: `devtools/components/CookiesTab.tsx`

### `devtools/components/RuleEditor.tsx`

- **Purpose**: Form for creating/editing rules — match spec, action type (mock/header), status code, body, headers, delay
- **Entry point**: `RuleEditor` component
- **Calls**: `shared/types.ts`, `devtools/components/JsonBodyEditor.tsx`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/RulesTable.tsx`

- **Purpose**: Displays rules grouped by domain with toggle/delete controls
- **Entry point**: `RulesTable` component
- **Calls**: `shared/types.ts`, `shared/url-parts.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/GroupsTable.tsx`

- **Purpose**: Groups-only management view (the "Groups" tab) — reordering, enable/delete, page-URL activation condition, and the "show in popup" preference
- **Entry point**: `GroupsTable` component
- **Calls**: `shared/types.ts`, `shared/messages.ts`, `shared/groups.ts`, `utils/id.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/StorageTab.tsx`

- **Purpose**: Lists Storage Profiles, reads/writes the inspected page's `localStorage` value for the selected profile, optional auto-reload after switching
- **Entry point**: `StorageTab` component
- **Calls**: `shared/types.ts`, `shared/messages.ts`, `devtools/inspected-window.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/StorageEditor.tsx`

- **Purpose**: Form for creating/editing a Storage Profile — key, candidate values, optional prefix/suffix wrapping
- **Entry point**: `StorageEditor` component
- **Calls**: `shared/types.ts`, `utils/id.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/CookiesTab.tsx`

- **Purpose**: Lists Cookie Profiles, reads/writes the inspected tab's cookie value (via the service worker's `chrome.cookies` access) for the selected profile, optional auto-reload after switching
- **Entry point**: `CookiesTab` component
- **Calls**: `shared/types.ts`, `shared/messages.ts`, `devtools/cookies.ts`, `devtools/inspected-window.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/CookiesEditor.tsx`

- **Purpose**: Form for creating/editing a Cookie Profile — cookie name, path, candidate values, optional prefix/suffix wrapping
- **Entry point**: `CookiesEditor` component
- **Calls**: `shared/types.ts`, `utils/id.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/HitLog.tsx`

- **Purpose**: Real-time view of mock hits received via port connection to background
- **Entry point**: `HitLog` component
- **Calls**: `shared/constants.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/DnrDebug.tsx`

- **Purpose**: Debug tab — shows registered vs. translated `declarativeNetRequest` rules, the last sync error, a "Test against URL" form (`TEST_DNR_MATCH`), and a live tail of real DNR rule matches via a port connection
- **Entry point**: `DnrDebug` component
- **Calls**: `shared/constants.ts`, `shared/messages.ts`, `shared/types.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/Settings.tsx`

- **Purpose**: Import/export rules, font size preferences, toast toggle, master enable/disable, capture column config
- **Entry point**: `Settings` component
- **Calls**: `shared/import-export.ts`, `shared/prefs.ts`, `shared/types.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/components/JsonBodyEditor.tsx`

- **Purpose**: Syntax-highlighted JSON editor textarea for mock response bodies
- **Entry point**: `JsonBodyEditor` component
- **Calls**: None
- **Called by**: `devtools/components/RuleEditor.tsx`

### `devtools/components/JsonTreeView.tsx`

- **Purpose**: Collapsible tree visualization for parsed JSON structures
- **Entry point**: `JsonTreeView` component
- **Calls**: None
- **Called by**: `devtools/components/RuleEditor.tsx`, `devtools/components/BodyPreview.tsx`, `devtools/capture/PromoteToRule.tsx`

### `devtools/components/BodyPreview.tsx`

- **Purpose**: Renders a captured request/response body — a collapsible colorized tree for valid JSON, raw monospace text otherwise
- **Entry point**: `BodyPreview` component
- **Calls**: `devtools/components/JsonTreeView.tsx`
- **Called by**: `devtools/capture/PromoteToRule.tsx`

## DevTools Capture

### `devtools/capture/Capture.tsx`

- **Purpose**: Network capture UI — filterable grid with domain/subdomain grouping, column customization, promote-to-rule action
- **Entry point**: `Capture` component
- **Calls**: `devtools/capture/types.ts`, `devtools/capture/PromoteToRule.tsx`, `shared/url-parts.ts`, `shared/messages.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/capture/use-capture.ts`

- **Purpose**: React hook managing capture buffer — reads from session storage, supports host filtering, HAR import, recording toggle
- **Entry point**: `useCapture()` hook
- **Calls**: `shared/constants.ts`, `utils/id.ts`, `devtools/capture/types.ts`
- **Called by**: `devtools/panel.tsx`

### `devtools/capture/PromoteToRule.tsx`

- **Purpose**: Dialog to convert a captured network entry into a mock rule with field checkboxes and pattern presets
- **Entry point**: `PromoteToRule` component
- **Calls**: `shared/types.ts`, `shared/messages.ts`
- **Called by**: `devtools/capture/Capture.tsx`

### `devtools/capture/types.ts`

- **Purpose**: `CapturedEntry` and `CapturedHeader` interfaces, plus helpers (`formatDuration`, `matchesHostFilter`, `approxBodySize`)
- **Entry point**: Type exports
- **Calls**: None
- **Called by**: `devtools/devtools.ts`, `devtools/capture/use-capture.ts`, `devtools/capture/Capture.tsx`

## Popup

### `popup/main.tsx`

- **Purpose**: Browser-action popup — master toggle, rule counts grouped by domain, link to DevTools panel
- **Entry point**: `Popup` component rendered into `popup/index.html`
- **Calls**: `shared/messages.ts`, `shared/types.ts`, `shared/use-prefs.ts`, `shared/url-parts.ts`
- **Called by**: `popup/index.html`

## Shared

### `shared/types.ts`

- **Purpose**: All domain types — `Rule`, `Group`, `GroupActivation`, `MatchSpec`, `MockAction`, `HeaderAction`, `StorageProfile`, `CookieProfile`, `DnrMatchEntry`, `AppState`, `MockHit`, `UIPreferences`, `ExportBundle`
- **Entry point**: Type exports
- **Calls**: None
- **Called by**: Every module in the project

### `shared/messages.ts`

- **Purpose**: `RuntimeMessage` union type (GET_STATE, MUTATE_STATE, MOCK_HIT, GET_DNR_DEBUG, TEST_DNR_MATCH, COOKIES_GET/SET/REMOVE, etc.), `StateMutation` union, `sendMessage()` helper, `isRuntimeMessage()` validator
- **Entry point**: `sendMessage()`, `RuntimeMessage` type
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `devtools/state-hook.ts`, `popup/main.tsx`, `content/index.ts`, `background/service-worker.ts`

### `shared/matcher.ts`

- **Purpose**: URL/method matching — `specMatches()` (exact/contains/regex/template), `isRuleActive()`, `isGroupActive()` (page-URL activation gate), `findFirstMockMatch()`, `buildActiveView()`
- **Entry point**: `specMatches()`, `findFirstMockMatch()`
- **Calls**: `shared/types.ts`, `shared/template.ts`
- **Called by**: `injected/page-mock.ts`, `background/rules-dnr.ts`

### `shared/template.ts`

- **Purpose**: `{random}` / `{random:N}` template tokens — compiles a template string to a matching regex, and generates fresh random alphanumeric values for mock response bodies
- **Entry point**: `templateToRegexSource()`, `compileTemplate()`, `hasTemplateTokens()`, `renderRandomTokens()`
- **Calls**: None
- **Called by**: `shared/matcher.ts`, `background/rules-dnr.ts`, `injected/page-mock.ts`

### `shared/groups.ts`

- **Purpose**: Pure array-reorder helpers for drag-and-drop group ordering
- **Entry point**: `moveItem()`, `reorderGroups()`
- **Calls**: `shared/types.ts`
- **Called by**: `background/service-worker.ts`, `devtools/components/GroupsTable.tsx`

### `shared/default-state.ts`

- **Purpose**: Single source of truth for the pristine `AppState` (master on, one empty "Default" group, no rules/profiles) — used for first-run seeding and Settings' "Reset all data"
- **Entry point**: `defaultAppState()`
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `background/storage.ts`

### `shared/constants.ts`

- **Purpose**: `STORAGE_KEYS`, `MESSAGE_TYPES`, `PORT_NAMES`, `PAGE_MESSAGE_TYPES`, `DNR_RULE_ID_OFFSET`, `MAX_RULES`, `MAX_STORAGE_PROFILES`, `MAX_COOKIE_PROFILES`, `MAX_HIT_LOG_ENTRIES`, `MAX_DNR_MATCH_ENTRIES`
- **Entry point**: Constant exports
- **Calls**: None
- **Called by**: Nearly every module

### `shared/import-export.ts`

- **Purpose**: `buildExportBundle()`, `buildSelectiveExportBundle()`, `filterBundle()`, `parseExportBundle()`, `validateBundle()`, `applyImport()` with three strategies (replace, merge-by-id, append-as-new), `detectConflicts()` / `applyImportWithResolutions()` for per-item conflict resolution
- **Entry point**: `applyImport()`, `buildExportBundle()`
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `devtools/components/Settings.tsx`

### `shared/prefs.ts`

- **Purpose**: UI preferences CRUD — `getPrefs()`, `setPrefs()`, `updatePrefs()`, `subscribePrefs()` backed by chrome.storage.local
- **Entry point**: `getPrefs()`, `updatePrefs()`
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `content/index.ts`, `devtools/components/Settings.tsx`

### `shared/use-prefs.ts`

- **Purpose**: React hook wrapping `prefs.ts` — `usePrefs()` returns current preferences and setter; `applyFontSizeVar()` sets CSS variable
- **Entry point**: `usePrefs()` hook
- **Calls**: `shared/prefs.ts`, `shared/types.ts`
- **Called by**: `devtools/panel.tsx`, `popup/main.tsx`

### `shared/url-parts.ts`

- **Purpose**: URL parsing — `deriveUrlParts()`, `baseDomainOf()`, `subdomainOf()`, `bucketByBaseDomain()`, `bucketBySubdomain()` with ccTLD support
- **Entry point**: `deriveUrlParts()`, `bucketByBaseDomain()`
- **Calls**: `shared/types.ts`
- **Called by**: `popup/main.tsx`, `devtools/capture/Capture.tsx`, `devtools/components/RulesTable.tsx`

## Utils

### `utils/id.ts`

- **Purpose**: `newId(prefix)` generates prefixed UUIDs (or fallback), `hashStringToInt(str)` hashes strings to integers for DNR rule IDs
- **Entry point**: `newId()`, `hashStringToInt()`
- **Calls**: None
- **Called by**: `background/rules-dnr.ts`, `devtools/devtools.ts`, `devtools/capture/use-capture.ts`
