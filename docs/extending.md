# Extending Phantom Mock

Recipes for the most common ways to extend the project. Each recipe lists exact files to touch, in order, with references to existing patterns.

## Add a new rule action type

Currently two action types exist: `mock` (response mocking) and `header` (header modification via DNR). To add a third (e.g., `redirect`, `delay-only`):

1. Define the action interface in `src/shared/types.ts` — add to the `RuleAction` union type, following the `kind` discriminator pattern from `MockAction` and `HeaderAction`
2. Add validation in `src/shared/import-export.ts` — extend `validateBundle()` to accept the new action kind during import
3. Add UI form section in `src/devtools/components/RuleEditor.tsx` — add a case to the action-kind selector and render appropriate fields (see existing mock/header form sections)
4. If the action runs client-side (like mock): handle it in `src/injected/page-mock.ts` — add a branch in `findMatch()` / the patched fetch handler
5. If the action runs at the network layer (like header): handle it in `src/background/rules-dnr.ts` — add a case in `translateToDnrRules()` to produce the corresponding `chrome.declarativeNetRequest.Rule`
6. Add tests in `tests/` — mirror `tests/shared/matcher.test.ts` for matching logic and `tests/background/rules-dnr.test.ts` for DNR translation
7. Run `npm test` to verify

## Add a new URL match type

Currently three match types exist: `exact`, `contains`, `regex`. To add a fourth (e.g., `glob`, `starts-with`):

1. Add the new value to `UrlMatchType` in `src/shared/types.ts`
2. Add a case to `urlMatches()` in `src/shared/matcher.ts` — follow the existing switch pattern
3. Add a case to the DNR condition builder in `src/background/rules-dnr.ts` — map to the appropriate `urlFilter` or `regexFilter` field in `buildCondition()`
4. Add the option to the match-type selector in `src/devtools/components/RuleEditor.tsx`
5. Add test cases in `tests/shared/matcher.test.ts` — each match type has a dedicated `describe` block
6. Run `npm test` to verify

## Add a new DevTools panel tab

The DevTools panel uses a simple tab-based layout in `src/devtools/panel.tsx`. To add a new tab (e.g., "Analytics"):

1. Create a new React component in `src/devtools/components/YourTab.tsx` — follow the pattern from `HitLog.tsx` (simplest) or `Settings.tsx` (more complex)
2. Import and add the tab in `src/devtools/panel.tsx`:
   - Add the tab name to the tab list
   - Add a conditional render block (`activeTab === 'your-tab' && <YourTab ... />`)
3. If the tab needs background state: use the existing `useAppState()` hook from `src/devtools/state-hook.ts`
4. If the tab needs new message types: add them in `src/shared/constants.ts` (`MESSAGE_TYPES`) and `src/shared/messages.ts` (`RuntimeMessage` union), then handle them in `src/background/index.ts`

## Add a new message type

Messages flow between contexts via `chrome.runtime.sendMessage`. To add a new message:

1. Add the type constant in `src/shared/constants.ts` under `MESSAGE_TYPES`
2. Add the message shape to the `RuntimeMessage` union in `src/shared/messages.ts`
3. Update the `isRuntimeMessage()` validator in `src/shared/messages.ts` if it checks specific types
4. Handle the message in `src/background/index.ts` — add a case in the `chrome.runtime.onMessage` listener (remember to `return true` for async responses)
5. If content scripts need to handle it: add a case in `src/content/index.ts`

## Add a new storage key

1. Add the key name to `STORAGE_KEYS` in `src/shared/constants.ts`
2. Add typed read/write functions in `src/background/storage.ts` or `src/shared/prefs.ts` (depending on whether it's app state or UI preferences)
3. If it's part of `AppState`: update the `AppState` interface in `src/shared/types.ts` and ensure `defaultState()` in `src/background/storage.ts` includes a default value

## Add a new import strategy

Currently three import strategies exist: `replace`, `merge-by-id`, `append-as-new`. To add a fourth:

1. Add the strategy name to the strategy type in `src/shared/import-export.ts`
2. Implement the merge logic in `applyImport()` — follow the pattern of the existing strategies
3. Add a radio/select option in `src/devtools/components/Settings.tsx` under the import dialog
4. Add test cases in `tests/shared/import-export.test.ts`
