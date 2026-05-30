# Changelog

All notable changes to Phantom Mock are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-05-30

### Added

- **Cookie profiles** — a new pair of DevTools panel tabs (**Cookies** and
  **Cookies Editor**) that mirror the Storage Profile UX for cookies on the
  inspected page. Define a profile once (label, cookie name, optional
  path, candidate values) and flip the cookie with a single chip click.
  Common case: `django_language` between `en` / `de` / `fr` without
  touching the Application panel. Backed by `chrome.cookies.get` /
  `chrome.cookies.set` / `chrome.cookies.remove` routed through the
  service worker, so **httpOnly cookies are fully supported** (sessionid,
  csrftoken, etc.) — `document.cookie` from the page would have silently
  failed on those.
- Cookie profiles round-trip through **Settings → Export / Import** as a
  separate "Cookie profiles" section in the selection tree, with the same
  per-item conflict resolution (`Overwrite` / `Rename as new`) as rules
  and storage profiles. Pre-0.5.0 export bundles without `cookieProfiles`
  still import cleanly.
- Optional **prefix / suffix** value wrapping (introduced for storage
  profiles in 0.4.0) also applies to cookie profiles — useful when a
  cookie holds e.g. URL-encoded or JSON-quoted content.

### Changed

- **New manifest permission**: `cookies`. Required to read/write `httpOnly`
  cookies via `chrome.cookies.*`. Existing v0.4.0 users will see a
  re-consent prompt on auto-update because of this permission addition;
  the Chrome Web Store re-review for v0.5.0 will need a justification
  noting that cookie reads/writes are scoped to the inspected tab's origin
  and are user-initiated only.

### Fixed

- Path scope handled correctly for cookies set/read on non-root paths
  (e.g. `/api/admin/`). Earlier draft passed the tab URL verbatim to
  `chrome.cookies.get` / `.remove`, which silently missed cookies whose
  path didn't fall under the tab's pathname. The URL is now rebuilt with
  the profile's configured path before each call. Unit-tested.

### Security

- **Cross-tab cookie spoofing guard**. The service-worker `COOKIES_GET` /
  `COOKIES_SET` / `COOKIES_REMOVE` handlers now require
  `sender.tab?.id === message.tabId` whenever the sender is a content
  script. Without this, a hypothetically-compromised content script could
  have called `chrome.runtime.sendMessage` with an arbitrary `tabId` and
  asked the SW to read or overwrite `httpOnly` auth cookies on a
  completely unrelated tab. Privileged extension-context senders (the
  DevTools panel, the popup) still accept any `tabId` since they know the
  inspected tab via `chrome.devtools.inspectedWindow.tabId`. Defense in
  depth — Chrome MV3 already restricts cross-extension messaging without
  `externally_connectable`, but the guard removes one whole class of
  threat from the model. Unit-tested.
- **`MUTATE_STATE` restricted to extension contexts.** Content scripts
  can no longer send a `replaceState` mutation to overwrite the user's
  persisted rules, groups, and profiles wholesale.

## [0.4.0] - 2026-05-30

### Added

- **Storage profiles** — a new pair of DevTools panel tabs (**Storage** and
  **Storage Editor**) that let you flip values on the inspected page's
  `localStorage` from a chip selector. Define a profile once (name, key,
  list of candidate values like `en_GB` / `de_DE`); the Storage tab reads
  the current value from the inspected page, shows it inline, and lets you
  switch to any candidate with one click. New UI pref **Auto-reload after
  switch** opts in to reloading the inspected page after each value
  change; otherwise a manual **Reload page** button is provided. Driven by
  `chrome.devtools.inspectedWindow.eval` from the panel — no service-worker
  changes on the eval path; profiles persist in `chrome.storage.local`
  with the same plumbing as rules.
- `StorageProfile` is round-tripped through Export / Import — bundles
  without a `storageProfiles` key (pre-0.4.0 exports) still import cleanly.
- **Storage profiles in Settings → Export / Import.** The selection tree
  in the Settings tab now lists storage profiles as a "Storage profiles"
  section below the rule groups, with the same per-item checkbox UX,
  Select-all behaviour, and conflict resolution (`Overwrite` /
  `Rename as new`) as rules. Previously profiles were silently auto-included
  in every export and import; now they're explicit.
- **Value wrapping (prefix / suffix) in the Storage Editor.** Two
  progressive-disclosure buttons — **+ Add prefix** and **+ Add suffix** —
  reveal text inputs that wrap every value before it lands in
  `localStorage`. Common case: `prefix = "` and `suffix = "` so JSON-quoted
  values like `"en_GB"` are written correctly. The Storage tab chips now
  display the **wrapped** value (what actually gets stored), and the
  current-value `is-active` highlight compares against the wrapped form.
  A live preview under the editor shows `prefix + <first value> + suffix`.

### Fixed

- Soft-migration for new `AppState` fields. The legacy `migrate()` path
  used to call `defaultState()` on any schema mismatch, which would have
  wiped every user's rules the next time the schema changed. Migration is
  now additive — missing optional fields are normalised (e.g.
  `storageProfiles` defaults to `[]`) and existing data is preserved.
- Friendly empty-state on the Storage tab when the panel is opened as a
  standalone extension page (`chrome-extension://…/panel.html`) instead of
  inside DevTools. Previously the row showed the raw exception
  `Cannot read properties of undefined (reading 'inspectedWindow')`; now
  it shows a banner explaining that the feature needs the DevTools host
  and points the user to **Right-click → Inspect → Phantom Mock**. Chips
  and the reload / refresh buttons are disabled in this mode so they
  can't trigger the same error.

## [0.3.0] - 2026-05-29

### Added

- `npm run build:local` and `npm run package:local` produce a side-by-side
  unpacked build whose manifest name is **Phantom Mock - Local** (and whose
  toolbar tooltip ends in `(Local)`). Loading `dist/` from a local checkout
  no longer collides with the published Chrome Web Store extension in
  `chrome://extensions` — both can be enabled at the same time. The
  packaged zip is suffixed `phantom-mock-local-X.Y.Z.zip` so it can't
  clobber the production artifact. Driven by Vite `--mode unpacked` (the
  name `local` is reserved by Vite for `.env.local`); no duplicate
  manifest file is maintained.
- New **Debug** tab in the DevTools panel surfaces the live state of
  `chrome.declarativeNetRequest`: currently-registered dynamic rules,
  what the current app state translates to, the last sync error (if any),
  and a **Test against URL** form that calls
  `chrome.declarativeNetRequest.testMatchOutcome` so the user can ask
  "would this URL match any of my header rules?" without re-loading a real
  page. New `GET_DNR_DEBUG` and `TEST_DNR_MATCH` runtime messages route
  through the service worker.
- **Live DNR matches** feed in the Debug tab. Subscribes to
  `chrome.declarativeNetRequest.onRuleMatchedDebug` (we already declare the
  `declarativeNetRequestFeedback` permission) and shows every header-rule
  fire in real time, with method, URL, rule name (resolved from the DNR
  integer id back to the user's rule), and timestamp. Backed by a new
  `src/background/dnr-match-log.ts` module mirroring the Hit Log's
  port-based buffer pattern, plus `CLEAR_DNR_MATCH_LOG` runtime message.
  Solves the "did my rule fire or not?" question that previously required
  reading network curls. Capped at 200 entries.
- **Header-rule scope warning** in the Rule Editor. When a header rule's
  method is not `*` (e.g. POST-only), an inline warning under the Method
  picker explains that redirected GETs and other verbs will NOT get the
  header — with a one-click **Set to \*** button. Catches the most common
  scoping mistake (login POST → 302 → GET to a redirect target that needs
  the same header) at authoring time. Mock rules are unaffected.

### Fixed

- Header overwrite rules silently failed for some rule IDs.
  `ruleIdFor()` in [`src/background/rules-dnr.ts`](src/background/rules-dnr.ts)
  computed `hashStringToInt(rule.id) % 2_000_000_000`, which could land on
  `0`. `chrome.declarativeNetRequest.updateDynamicRules` rejects IDs less
  than 1 with `"id must be >= 1"` and discards the whole batch — so a
  single unlucky rule made _every_ header rule disappear with no
  user-visible signal. Now clamped to the range `1..1_999_999_999` (still
  inside DNR's 32-bit signed-int ceiling). Unit-tested.
- The service worker no longer swallows
  `chrome.declarativeNetRequest.updateDynamicRules` failures. Each of the
  three sync paths (`onInstalled`, `onStartup`, and the storage
  `subscribe` callback) now routes through `syncDnrWithDiagnostics`,
  which logs the failure with the offending translated rule JSON to the
  service-worker console and stashes the message + payload so the new
  Debug tab can show it.

## [0.2.0] - 2026-05-23

### Added

- Multi-select rules in the Rules tab. Each rule row now has a small
  selection checkbox at the far left (in the accent colour, scaled slightly
  smaller than the enable / disable checkbox so the two are visually
  distinct). Each group header has its own select-all checkbox with
  tri-state (none / some / all selected) indicating how many of its rules
  are picked. When any rule is selected, a bulk-action bar appears showing
  the count plus **Clear selection** and **Delete selected** buttons. Bulk
  delete asks for one confirmation, then issues one `deleteRule` mutation
  per id. State is session-only; stale ids are pruned automatically if the
  rule list changes underneath the user.
- Collapse / expand groups, in both the DevTools panel's **Rules** tab and
  the toolbar **popup**:
  - A chevron on the left of each group header toggles just that group.
  - **Expand all** / **Collapse all** buttons fold every group at once
    (in the Rules-tab toolbar and a thin sub-bar at the top of the popup).
  - State is per-panel-session / per-popup-open (not persisted).
  - Group rule-count badge shown next to the group name.

### Fixed

- Service worker no longer fails to register with "Status code: 15". The
  background entry point was renamed from `src/background/index.ts` to
  `src/background/service-worker.ts` so `@crxjs/vite-plugin@2.4` can no
  longer collide its chunk with `src/content/index.ts` (both used to share
  the basename `index.ts` and CRXJS would route the SW loader to the
  content-script bundle, which then crashed because service workers don't
  have `document`).
- Header rules now also apply to `main_frame` and `sub_frame` requests, not
  just `xmlhttprequest`. Previously, custom headers like `X-Tenant-ID`
  configured in a header rule were silently dropped on page navigations and
  iframe loads — they only worked on fetch/XHR. Mock rules are unaffected
  (they still run through the page-world `fetch` / `XMLHttpRequest` patcher
  and inherently only see those two API types).
- Empty header rows in the Rule Editor are stripped on save. A half-filled
  row (`{ name: "", op: "set", value: "" }`) could previously survive into
  the persisted rule and cause `chrome.declarativeNetRequest` to silently
  reject the entire rule.
- JSON import now silently drops header rows with an empty `name` instead of
  rejecting the whole bundle. Old export files that pre-date the editor
  strip-on-save fix can now be re-imported without manual JSON editing.
- Import-conflict resolution per rule: when "Merge by id" is selected, any
  incoming **rule** whose `id` already exists in the current state is flagged
  with a `⚠ already exists` badge in the preview tree, with inline
  **Overwrite** / **Rename as new** radios. Defaults to **Overwrite** (legacy
  behaviour); selecting **Rename as new** keeps the existing rule and adds
  the imported one with a fresh `id` and an auto-incremented name suffix
  (`MyRule` → `MyRule (2)` → `MyRule (3)` …). **Groups** with a colliding
  `id` are silently merged into the existing group — the user's group name,
  enabled flag, and order are preserved, and imported rules just land inside
  the existing group. Implemented in `applyImportWithResolutions` /
  `detectConflicts` in `import-export.ts`.

### Changed

- Master switch in the popup and DevTools panel is now a sliding pill toggle
  instead of a native checkbox. Behaviour identical (`checked` state still
  binds to `state.masterEnabled`); CSS-only via a new `.pm-toggle` class.
- Per-group and per-rule **enable/disable** checkboxes in both the popup and
  the DevTools panel's Rules tab are now compact toggle pills
  (`.pm-toggle.pm-toggle-sm` — 26-28 px wide), so the visual language is
  consistent across master, group and rule level. The bulk-select checkbox
  in the Rules tab stays a standard square checkbox so it's visually
  distinct from the enable toggles.
- Upgraded React from 18.3 to 19.2, including `@types/react` and
  `@types/react-dom`. Added explicit `type JSX` imports across components
  (`panel.tsx`, `popup/main.tsx`, `RuleEditor`, `RulesTable`, `Capture`,
  `PromoteToRule`, `HitLog`, `JsonTreeView`, `Settings`) to match React 19's
  JSX-namespace changes.
- Upgraded the Vite toolchain: Vite 5.4 → 8.0, `@vitejs/plugin-react` 4.3 →
  6.0, `vitest` 2.1 → 4.1, `@vitest/coverage-v8` 2.1 → 4.1.
- Upgraded ESLint stack: `eslint` 9.15 → 10.4, `@eslint/js` 9.15 → 10.0,
  `eslint-plugin-react-hooks` 5.0 → 7.1, `eslint-plugin-react-refresh` 0.4 →
  0.5, `eslint-config-prettier` 9.1 → 10.1, `@typescript-eslint/*` 8.15 →
  8.59.
- Upgraded `@types/chrome` to 0.1.42.
- CI now runs the test matrix on Node 20 and 22 (was 18 and 20).
- `dependabot.yml` now groups Vite-related packages so version bumps come in
  a single coordinated PR.

## [0.1.3] - 2026-05-18

### Changed

- Removed the `scripting` permission from `manifest.json` and from all
  store-listing copy. The permission was declared but never used at runtime
  (page-world script injection is handled by the `content_scripts` entry
  with `"world": "MAIN"`, which doesn't require this permission). Removed
  to comply with Chrome Web Store policy (rejection code "Purple
  Potassium"); the resubmission passed.

## [0.1.1] - 2026-05-17

### Added

#### Core mocking

- Response mocking for REST APIs (`fetch` + `XMLHttpRequest`) via a page-world
  content script registered with `world: "MAIN"`, so it runs before page
  scripts at `document_start`.
- URL match types: `exact`, `contains`, and `regex`, plus per-method filtering
  (wildcard `*` supported).
- Per-rule controls: status code, response delay, response body, content-type,
  custom response headers, and a "log to Hit Log" flag.
- Header overwrite rules via `chrome.declarativeNetRequest` dynamic rules —
  `set` / `append` / `remove` on both request and response headers, scoped to
  `xmlhttprequest` resource type (REST-only).
- Group management with cascading enable/disable for all rules inside.
- Master kill switch surfaced in both the popup and the DevTools panel.
- In-page toast notification when a mock rule fires (truncated rule name,
  rendered in an isolated Shadow DOM so it can't conflict with page CSS).
  Opt-in via Settings.

#### DevTools panel "Phantom Mock"

- **Rules** tab — grouped rule list with toggles, rename, delete, edit, clone.
- **Editor** tab — full CRUD form. Inline "+ New" button on the group select to
  create a group without leaving the form. Live regex / JSON / status-code /
  delay validation. "Test against URL" field for matcher preview.
- **Hit Log** tab — live tail of mocked requests via a long-lived port to the
  service worker; filterable, clearable.
- **Capture** tab — listens to `chrome.devtools.network.onRequestFinished` from
  `devtools.ts` (so capturing starts the instant DevTools opens), buffered in
  `chrome.storage.session`. Host filter, record/stop toggle, Import from
  Network HAR log, Reload page, Clear. Rows are grouped by registrable domain
  then subdomain (collapsible). Customizable columns (time, method, status,
  path, size, duration) via a Columns dropdown.
- **Capture → Promote to rule** — click any captured request to open a side
  pane with checkboxes for each field (status, content-type, response body,
  individual request/response headers) and one-click pattern presets (Use
  path / Use full URL / Use host). Result is saved via the same `upsertRule`
  flow as the manual editor.
- **Settings** tab — Appearance (font size: small / normal / big / custom px),
  Notifications (toast on/off), Export (checkbox tree, selective), Import
  (checkbox tree preview, merge strategies: replace / merge-by-id /
  append-as-new).
- Collapsible JSON tree view in the response body editor with **Edit/Tree**
  mode toggle, Expand all / Collapse all, Pretty/Minify/Copy, and editable
  primitives in tree mode (click a string/number/null to edit, click a
  boolean to toggle).

#### Popup

- 360px React popup with master switch.
- Rules grouped by **registrable domain → subdomain → path** (mirrors the
  capture-tab layout). HTTPS / HTTP / other shown as a lock icon — never as
  raw protocol text.

#### Debug helpers (page console)

- `window.__phantomMock.installed` / `fetchPatched` / `masterEnabled` /
  `ruleCount` / `rules()` / `test(url, method)` / `setVerbose(true)` —
  inspect runtime state and trace match decisions from the page's console.
- Install-time `[phantom-mock] installed on <url>` log so users can confirm
  the patch loaded.

#### Engineering

- Vite + CRXJS build pipeline; strict TypeScript; named-exports-only.
- CI workflows: `ci` (lint, format, typecheck, tests, build on Node 18/20),
  `auto-assign-author` (PR author auto-assignment), `security-audit` (weekly
  `npm audit`, also gated on dependency-changing PRs), and `release`
  (tag-driven build, zip package, GitHub Release, optional Chrome Web Store
  publish).
- Husky pre-commit hook running `lint-staged`.
- `.github/dependabot.yml` for weekly npm + GitHub-Actions updates.
- Ghost-silhouette extension icon set (16/32/48/128).
- Chrome Web Store submission assets: `PRIVACY.md`, `store-assets/listing.md`,
  `store-assets/SUBMISSION-CHECKLIST.md`, placeholder screenshots and promo
  tile.

### Submission notes

- First Chrome Web Store submission. **Rejected** by automated review for
  declaring the `scripting` permission without using it ("Purple Potassium"
  violation). Never publicly available. Fixed in 0.1.3.

## [0.1.0] - 2026-05-17

### Added

- Initial scaffold of the Phantom Mock Chrome MV3 extension. Never submitted
  to the Chrome Web Store. All user-facing features arrived in 0.1.1.
