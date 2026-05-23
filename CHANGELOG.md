# Changelog

All notable changes to Phantom Mock are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- Master switch in the popup and DevTools panel is now a sliding pill toggle
  instead of a native checkbox. Behaviour identical (`checked` state still
  binds to `state.masterEnabled`); CSS-only via a new `.pm-toggle` class.
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
