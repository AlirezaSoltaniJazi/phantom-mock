---
name: chromeExtensionDeveloper
description: >-
  Chrome extension development skill for the phantom-mock project. Covers
  Manifest V3, service worker lifecycle, content scripts, declarativeNetRequest
  rules, message passing, popup UI, storage patterns, build tooling, and
  testing. Activates when editing manifest.json, writing content/background
  scripts, configuring permissions, implementing chrome.* APIs, debugging
  extension behavior, building popup/options UI, or managing Chrome Web Store
  publishing.
compatibility: "Chrome MV3, TypeScript 5+, Vite + CRXJS, Vitest, ESLint, Prettier"
metadata:
  author: phantom-mock
  version: "1.0.0"
  sdlc-phase: development
allowed-tools: Read Edit Write Bash(npm:*) Bash(npx:*) Bash(node:*) Glob Grep Agent
---

<!-- SKILL.md target: <=300 lines / <3,500 tokens. Tables, rules, checklists, links only. Code examples go in references/. -->

## Before You Start

**Read [LEARNED.md](LEARNED.md) first.** It contains corrections, preferences, and conventions accumulated from previous sessions. Apply every rule in that file — they override defaults in this skill.

**Announce skill usage.** Always say "Using: chromeExtensionDeveloper skill" at the very start of your response before doing any work.

## When to Use

1. Writing or modifying `manifest.json`, service worker, or content scripts
2. Implementing chrome.* API calls (declarativeNetRequest, storage, tabs, scripting)
3. Building popup, options page, or side panel UI components
4. Setting up message passing between extension contexts (content <-> background <-> popup)
5. Configuring permissions, host_permissions, or CSP policies
6. Writing or updating extension tests (Vitest with chrome API mocks)

## Do NOT Use

- **General web app UI** (React/Vue pages unrelated to extension surfaces) — use frontend skill
- **Backend API server code** (Express, Fastify, REST endpoints) — use backend skill
- **General TypeScript/JavaScript** (utilities not tied to chrome.* APIs) — use JS/TS skill

## Architecture

```
phantom-mock/
├── manifest.json              # MV3 manifest — permissions, service_worker, content_scripts
├── src/
│   ├── background/
│   │   ├── index.ts           # Service worker entry — lifecycle, event listeners
│   │   ├── rules.ts           # declarativeNetRequest rule management
│   │   └── storage.ts         # chrome.storage state management
│   ├── content/
│   │   ├── index.ts           # Content script entry — DOM observation, injection
│   │   └── ui.ts              # Shadow DOM injected UI components
│   ├── popup/
│   │   ├── index.html         # Popup entry HTML
│   │   ├── main.ts            # Popup logic — rule CRUD, toggle
│   │   └── components/        # Popup UI components
│   ├── options/
│   │   └── index.ts           # Options page for advanced configuration
│   ├── shared/
│   │   ├── types.ts           # Shared type definitions (messages, rules, state)
│   │   ├── constants.ts       # Extension-wide constants
│   │   └── messages.ts        # Typed message schemas + helpers
│   └── utils/
│       └── index.ts           # Pure utility functions
├── public/
│   └── icons/                 # Extension icons (16, 32, 48, 128)
├── tests/
│   ├── setup.ts               # Chrome API mock setup (jest-chrome/sinon-chrome)
│   ├── background/            # Service worker unit tests
│   ├── content/               # Content script unit tests
│   └── popup/                 # Popup component tests
├── vite.config.ts             # Vite + CRXJS plugin configuration
├── tsconfig.json              # Strict TypeScript configuration
└── package.json               # Dependencies, scripts, dev tools
```

**Data flow**: Popup UI -> message to service worker -> update chrome.storage + declarativeNetRequest rules -> content script reacts to rule changes.

**Core purpose**: Mock URLs and intercept HTTP requests via declarativeNetRequest rules managed through a popup interface.

## Key Patterns

| Pattern                 | Approach                                         | Key Rule                                              |
| ----------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Request interception    | `chrome.declarativeNetRequest` with dynamic rules | Never use webRequest blocking in MV3                  |
| State management        | `chrome.storage.local` with typed wrappers       | Always use typed get/set helpers, never raw API       |
| Message passing         | Typed schemas via `chrome.runtime.sendMessage`   | Every message has `type` discriminant + typed payload |
| Service worker lifecycle| Event-driven with `chrome.alarms` for persistence| Never assume SW stays alive — recover state on wake   |
| Content script UI       | Shadow DOM isolation                             | Never pollute page global styles or namespace         |
| Popup communication     | One-time messages to service worker              | Always handle `chrome.runtime.lastError`              |
| Rule storage            | Typed rule objects in chrome.storage.local        | Validate rules before applying to declarativeNetRequest|
| Error handling          | Result objects `{ success, data?, error? }`      | Never throw in async chrome API callbacks             |

See [references/manifest-patterns.md](references/manifest-patterns.md) for full code examples.

## Code Style

| Rule                  | Convention                                                         |
| --------------------- | ------------------------------------------------------------------ |
| Language              | TypeScript 5+ strict mode (`strict: true` in tsconfig)             |
| Formatter             | Prettier (2 spaces, single quotes, trailing commas)                |
| Linter                | ESLint with @typescript-eslint, no-floating-promises               |
| Import style          | Path aliases (`@/` for `src/`) — never deep relative (`../../`)    |
| Import order          | builtin -> external -> @/ aliases -> relative (auto-sorted)        |
| Type hints            | Explicit return types on all exported functions                     |
| Naming — files        | `kebab-case.ts` for modules, `PascalCase.tsx` for components       |
| Naming — types        | `PascalCase` (e.g., `MockRule`, `MessagePayload`)                  |
| Naming — functions    | `camelCase` with descriptive verbs (`createRule`, `handleMessage`)  |
| Naming — constants    | `SCREAMING_SNAKE_CASE` (e.g., `MAX_RULES`, `STORAGE_KEYS`)        |
| Naming — messages     | `SCREAMING_SNAKE_CASE` type discriminants (`ADD_RULE`, `TOGGLE`)   |
| Exports               | Named exports only — never default exports                         |
| Strings               | Single quotes (enforced by Prettier)                               |
| No `any`              | Use `unknown` + type guards — `any` is forbidden                   |
| Async                 | Always `async/await` — never raw `.then()` chains                  |

See [references/code-style.md](references/code-style.md) for full formatting examples.

## Common Recipes

1. **Add a new mock rule type**: Define type in `shared/types.ts` -> add handler in `background/rules.ts` -> add UI control in `popup/components/` -> add message type in `shared/messages.ts`
2. **Add a new chrome API permission**: Add to `manifest.json` permissions array -> add justification comment -> update `references/manifest-patterns.md` -> test in isolation
3. **Create a new content script**: Add entry in manifest `content_scripts` -> create `src/content/feature.ts` -> use Shadow DOM for any UI -> register message listener -> test with mock DOM
4. **Add a context menu item**: Register in service worker `chrome.runtime.onInstalled` -> handle click in `chrome.contextMenus.onClicked` -> send result via messaging
5. **Add storage migration**: Create versioned migration in `background/storage.ts` -> run on `chrome.runtime.onInstalled` with `reason === 'update'` -> validate before + after
6. **Add new message type**: Add type to `MessageType` enum -> define payload interface -> add handler in receiver -> add sender helper function -> update tests

## Testing Standards

| Rule              | Convention                                                      |
| ----------------- | --------------------------------------------------------------- |
| Framework         | Vitest with `@anthropic-ai/chrome-types` or `jest-chrome` mocks |
| Test file naming  | `*.test.ts` co-located or in `tests/` mirror                    |
| Chrome API mocks  | Global mock setup in `tests/setup.ts`                           |
| DOM testing       | `happy-dom` or `jsdom` for content script tests                 |
| E2E              | Playwright with `--load-extension` for integration              |
| What to mock      | All chrome.* APIs, fetch/XMLHttpRequest, DOM when expensive     |
| What NOT to mock  | Type construction, pure utility functions, message schemas       |
| Coverage target   | Service worker logic 80%+, message handlers 90%+                |

See [references/test-patterns.md](references/test-patterns.md) for full test examples.

## Performance Rules

- Use `chrome.scripting.executeScript` for lazy injection — avoid declaring all content scripts in manifest
- Minimize service worker wake-ups — batch storage operations, use `chrome.alarms` sparingly
- Use `chrome.declarativeNetRequest` over `webRequest` — it's faster and doesn't wake the SW per request
- Debounce DOM observations in content scripts — MutationObserver can fire rapidly
- Avoid storing large objects in `chrome.storage.sync` (100KB quota) — use `.local` for bulk data
- Lazy-load popup UI components — keep popup open time fast
- Use `requestIdleCallback` in content scripts for non-critical DOM work

## Security

- Never use `eval()`, `new Function()`, or inline scripts — CSP forbids them in MV3
- Validate all messages with type guards before processing — reject unknown message types
- Restrict `externally_connectable` to specific origins — never use wildcard
- Minimize `web_accessible_resources` exposure — only expose what content scripts need
- Sanitize all user input before injecting into DOM (even in Shadow DOM)
- Use `activeTab` permission over broad `<all_urls>` host_permissions when possible
- Never store sensitive data in `chrome.storage.sync` — it syncs to Google account

See [references/security-checklist.md](references/security-checklist.md) for detailed checklists.

## Anti-Patterns

| Anti-Pattern                                | Why It's Wrong                                                    |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Using `chrome.webRequest` for blocking      | Deprecated in MV3 — use `declarativeNetRequest`                   |
| Using `eval()` or `new Function()`          | Blocked by MV3 CSP — causes extension to fail silently            |
| Storing state in service worker memory      | SW terminates unpredictably — state is lost                       |
| Using `any` type for messages               | Loses type safety — bugs in message handling go undetected        |
| Broad `<all_urls>` host_permissions         | Chrome Web Store rejects or delays review — use `activeTab`       |
| Raw `chrome.storage.get/set` without types  | No validation — corrupt data silently breaks extension            |
| Polling in service worker (`setInterval`)   | Prevents SW from sleeping — use `chrome.alarms` instead           |
| Default exports                             | Breaks tree-shaking and makes refactoring harder                  |
| Deep relative imports (`../../../`)          | Fragile and unreadable — use `@/` path aliases                    |
| Injecting styles without Shadow DOM         | Pollutes host page CSS — breaks both extension and page           |

## Code Generation Rules

1. **Read before writing** — always read the target file and related modules before making changes
2. **Match existing style** — follow Prettier, ESLint, and import conventions exactly
3. **Type everything** — exported functions need explicit return types, messages need discriminants
4. **Handle errors** — every chrome API call checks `chrome.runtime.lastError` or uses try/catch
5. **Test alongside** — when creating a module, create its test file with chrome API mocks
6. **On correction** — acknowledge, restate as rule, apply to all subsequent actions, write to [LEARNED.md](LEARNED.md)
7. **On ambiguity** — check [LEARNED.md](LEARNED.md) first, then project files, ask ONE question, write preference to [LEARNED.md](LEARNED.md)

## Adaptive Interaction Protocols

Corrections and preferences persist via [LEARNED.md](LEARNED.md).

| Mode       | Detection Signal                                                       | Behavior                                                              |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Diagnostic | "manifest error", "SW terminated", "content script not injecting"      | Read error context, trace to root cause, fix with minimal changes     |
| Efficient  | "another content script like X", "add rule type", "same pattern as Y"  | Minimal explanation, replicate existing patterns, apply conventions    |
| Teaching   | "what does chrome.runtime do", "explain declarativeNetRequest"         | Explain with references to project examples, link to references/      |
| Review     | "review manifest", "check permissions", "audit CSP"                    | Read-only analysis, check against conventions, report without changes |

**Self-Learning**: All learnings are **written** to LEARNED.md — not suggested, written:

- Corrections -> `## Corrections` section
- Preferences -> `## Preferences` section
- Discovered conventions -> `## Discovered Conventions` section
- Format: `- YYYY-MM-DD: rule description`

## Sub-Agent Delegation

| Agent            | Role                                              | Spawn When                                           | Tools                          |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------- | ------------------------------ |
| code-reviewer    | Read-only Chrome extension code analysis          | PR review, architecture compliance, manifest audit   | Read Glob Grep                 |
| security-auditor | CSP and permissions audit for extension security  | Security review, permission audit, CSP verification  | Read Glob Grep                 |
| test-writer      | Test generation following project conventions     | "write tests for X", new script creation, coverage   | Read Edit Write Glob Grep Bash |

**Delegation rules**: Spawn when task is self-contained and won't need follow-up context. Never delegate tasks requiring architectural decisions. See [agents/](agents/) for full definitions.

## Freedom Levels

| Level             | Scope                                                                           | Examples                                                          |
| ----------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **MUST** follow   | Typed messages, no `any`, declarativeNetRequest, Shadow DOM, path aliases       | "MUST type all messages", "MUST use declarativeNetRequest in MV3" |
| **SHOULD** follow | Named exports, explicit return types, co-located tests, chrome.storage wrappers | "SHOULD export named", "SHOULD wrap chrome.storage calls"         |
| **CAN** customize | Component structure, test organization, popup framework choice                  | "CAN use React/Preact/Solid for popup", "CAN group tests by file"|

## References

| File                                                                             | Description                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [LEARNED.md](LEARNED.md)                                                         | **Auto-updated.** Corrections, preferences, conventions  |
| [INJECT.md](INJECT.md)                                                           | Always-loaded quick reference (hallucination firewall)   |
| [references/manifest-patterns.md](references/manifest-patterns.md)               | Manifest configuration patterns and examples             |
| [references/message-passing-guide.md](references/message-passing-guide.md)       | Typed message schemas, routing, port lifecycle examples  |
| [references/service-worker-patterns.md](references/service-worker-patterns.md)   | Persistence, lifecycle, state recovery patterns          |
| [references/code-style.md](references/code-style.md)                             | Import order, TypeScript conventions, full examples      |
| [references/security-checklist.md](references/security-checklist.md)             | Per-permission, per-CSP, per-content-script checklists   |
| [references/common-issues.md](references/common-issues.md)                       | Troubleshooting common Chrome extension pitfalls         |
| [references/test-patterns.md](references/test-patterns.md)                       | Vitest setup, chrome mock patterns, DOM testing examples |
| [references/ai-interaction-guide.md](references/ai-interaction-guide.md)         | Anti-dependency strategies, correction protocols         |
| [content-script-template.ts](content-script-template.ts)                         | Copy-paste content script template                       |
| [assets/manifest-template.json](assets/manifest-template.json)                   | manifest.json starter template                           |
| [scripts/validate-chrome-extension.sh](scripts/validate-chrome-extension.sh)     | Manifest + structure convention checker                  |
| [agents/code-reviewer.md](agents/code-reviewer.md)                               | Read-only Chrome extension code analysis agent           |
| [agents/security-auditor.md](agents/security-auditor.md)                         | CSP and permissions audit agent                          |
| [agents/test-writer.md](agents/test-writer.md)                                   | Test generation agent                                    |
