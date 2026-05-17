# Modules

Source-map of every module in the project. Use this to find the right file to read first for any given concern.

## Background (Service Worker)

### `background/index.ts`

- **Purpose**: Main service worker — handles Chrome runtime messages, applies state mutations, broadcasts rule updates to all tabs
- **Entry point**: `chrome.runtime.onMessage` listener, `chrome.runtime.onInstalled` listener
- **Calls**: `background/storage.ts`, `background/rules-dnr.ts`, `background/log.ts`, `shared/matcher.ts`
- **Called by**: DevTools panel, popup, content scripts (via Chrome messaging)

### `background/storage.ts`

- **Purpose**: Chrome storage wrapper — persists `AppState` to `chrome.storage.local`, provides reactive subscriptions
- **Entry point**: `getState()`, `setState()`, `updateState()`, `subscribe()`
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `background/index.ts`

### `background/rules-dnr.ts`

- **Purpose**: Translates header-type rules to Chrome `declarativeNetRequest` dynamic rules
- **Entry point**: `syncDnrRules()`, `translateToDnrRules()`
- **Calls**: `shared/matcher.ts`, `utils/id.ts`
- **Called by**: `background/index.ts` (via storage subscriber)

### `background/log.ts`

- **Purpose**: In-memory hit log buffer with port-based pub/sub to DevTools
- **Entry point**: `recordHit()`, `getHits()`, `clearHits()`, `registerLogPortListener()`
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `background/index.ts`

## Content Script

### `content/index.ts`

- **Purpose**: Bridges page world and service worker — relays rules to page injection, forwards hit events back to background, manages toast display
- **Entry point**: Self-executing on `document_start` (isolated world)
- **Calls**: `shared/messages.ts`, `shared/prefs.ts`, `content/toast.ts`
- **Called by**: Service worker (via `chrome.tabs.sendMessage`)

### `content/toast.ts`

- **Purpose**: Shadow-DOM toast notifications shown when a mock rule is applied
- **Entry point**: `showRuleAppliedToast(ruleName)`
- **Calls**: None
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

- **Purpose**: Main DevTools React app — tab-based interface (Rules, Editor, Hits, Capture, Settings), manages editing state and font size
- **Entry point**: `App` component rendered into `panel.html`
- **Calls**: `devtools/state-hook.ts`, all `devtools/components/*`, `devtools/capture/*`, `shared/use-prefs.ts`, `shared/url-parts.ts`
- **Called by**: `panel.html`

### `devtools/state-hook.ts`

- **Purpose**: React hook that fetches `AppState` from the service worker and dispatches mutations
- **Entry point**: `useAppState()` hook
- **Calls**: `shared/messages.ts`, `shared/constants.ts`
- **Called by**: `devtools/panel.tsx`

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

### `devtools/components/HitLog.tsx`

- **Purpose**: Real-time view of mock hits received via port connection to background
- **Entry point**: `HitLog` component
- **Calls**: `shared/constants.ts`
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
- **Called by**: `devtools/components/RuleEditor.tsx`, `devtools/capture/PromoteToRule.tsx`

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

- **Purpose**: All domain types — `Rule`, `Group`, `MatchSpec`, `MockAction`, `HeaderAction`, `AppState`, `MockHit`, `UIPreferences`, `ExportBundle`
- **Entry point**: Type exports
- **Calls**: None
- **Called by**: Every module in the project

### `shared/messages.ts`

- **Purpose**: `RuntimeMessage` union type (GET_STATE, MUTATE_STATE, MOCK_HIT, etc.), `StateMutation` union, `sendMessage()` helper, `isRuntimeMessage()` validator
- **Entry point**: `sendMessage()`, `RuntimeMessage` type
- **Calls**: `shared/types.ts`, `shared/constants.ts`
- **Called by**: `devtools/state-hook.ts`, `popup/main.tsx`, `content/index.ts`, `background/index.ts`

### `shared/matcher.ts`

- **Purpose**: URL/method matching — `specMatches()` (exact/contains/regex), `isRuleActive()`, `findFirstMockMatch()`, `buildActiveView()`
- **Entry point**: `specMatches()`, `findFirstMockMatch()`
- **Calls**: `shared/types.ts`
- **Called by**: `injected/page-mock.ts`, `background/rules-dnr.ts`

### `shared/constants.ts`

- **Purpose**: `STORAGE_KEYS`, `MESSAGE_TYPES`, `PORT_NAMES`, `PAGE_MESSAGE_TYPES`, `DNR_RULE_ID_OFFSET`, `MAX_RULES`, `MAX_HIT_LOG_ENTRIES`
- **Entry point**: Constant exports
- **Calls**: None
- **Called by**: Nearly every module

### `shared/import-export.ts`

- **Purpose**: `buildExportBundle()`, `parseExportBundle()`, `validateBundle()`, `applyImport()` with three strategies (replace, merge-by-id, append-as-new)
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
