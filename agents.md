# Phantom Mock — AI Agent Context

## What This Is

Chrome extension (Manifest V3) that mocks REST API responses and intercepts HTTP requests directly in the browser. Developers use the DevTools panel to define URL-matching rules, capture live network traffic, and return mock responses — without touching backend code or proxies. Built with TypeScript 5.6 strict, React 18, Vite + CRXJS.

## Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Language | TypeScript 5.6 (strict, no `any`)                |
| UI       | React 18.3                                       |
| Build    | Vite 5.4 + @crxjs/vite-plugin 2.0                |
| Test     | Vitest 2.1 + happy-dom                           |
| Lint     | ESLint 9 (flat config) + Prettier 3.3            |
| Runtime  | Chrome Extension Manifest V3                     |
| Storage  | chrome.storage.local (typed wrappers)            |
| Network  | declarativeNetRequest (DNR) + fetch/XHR patching |

## Project Structure

```
src/
├── background/          # Service worker — state manager, message hub, DNR rule sync
├── content/             # Content script (isolated world) — bridges page ↔ service worker
├── injected/            # Page-world script (MAIN) — patches fetch/XHR, matches rules
├── popup/               # Browser action popup — master toggle, rule counts
├── devtools/            # DevTools panel — Rules, Editor, Hits, Capture, Settings tabs
│   ├── components/      # Tab components (RuleEditor, RulesTable, HitLog, Settings)
│   └── capture/         # Network capture + promote-to-rule workflow
├── shared/              # Types, messages, constants, matcher, import/export
└── utils/               # ID generation, helpers
tests/                   # Vitest tests mirroring src/ structure
docs/                    # Architecture, modules, dataflow, extending, troubleshooting
scripts/                 # bump-version.mjs, zip-extension.mjs
public/icons/            # Extension icons (16/32/48/128)
.data/skills/            # AI skill definitions and reference guides
```

## How To Run

```bash
# Install dependencies
npm install

# Dev server (load dist/ as unpacked extension in Chrome)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint + format check
npm run lint && npm run format:check

# Full release pipeline (lint, format, typecheck, test, package)
npm run release

# Package for distribution
npm run package
```

## Development Conventions

### Code Style

- Prettier: single quotes, trailing commas, 100-char width, 2-space indent, semicolons
- ESLint: strict no-any (warn), eqeqeq (error), no-throw-literal (error)
- All exported functions MUST have explicit return types
- Named exports only — never default exports
- Type-only imports on separate lines: `import type { X } from '...'`

### Naming Conventions

| Entity             | Style                | Example                               |
| ------------------ | -------------------- | ------------------------------------- |
| Files (modules)    | kebab-case           | `rules-dnr.ts`, `use-prefs.ts`        |
| Files (components) | PascalCase           | `RuleEditor.tsx`, `HitLog.tsx`        |
| Types/Interfaces   | PascalCase           | `Rule`, `AppState`, `MockAction`      |
| Constants          | SCREAMING_SNAKE      | `MESSAGE_TYPES`, `STORAGE_KEYS`       |
| Functions/vars     | camelCase            | `getState()`, `specMatches()`         |
| Booleans           | is/has/should prefix | `isRuleActive()`, `hasPermission`     |
| IDs                | prefixed UUID        | `rule_`, `grp_`, `cap_` via `newId()` |

### Import Order

```typescript
// 1. External packages
import { useState, useEffect } from 'react';

// 2. @/ path aliases (cross-directory)
import { MESSAGE_TYPES } from '@/shared/constants';
import type { Rule } from '@/shared/types';

// 3. Relative imports (same feature directory only)
import { JsonBodyEditor } from './JsonBodyEditor';
```

Never use deep relative paths (`../../`) — always use `@/` aliases.

### Error Handling

- Result objects `{ ok: true; value: T } | { ok: false; error: string }` for fallible ops
- Type guards validate all untrusted data before use
- `chrome.runtime.lastError` always checked in chrome API callbacks
- Regex compilation returns `null` on failure — never throws
- React components: try/catch with `setError()` state

## Architecture Rules

- **Service worker is the single source of truth** — all state mutations flow through `background/index.ts`
- **Immutable state updates only** — spread operator, `upsertById()` helper, never mutate in-place
- **Typed discriminated unions for messages** — `RuntimeMessage` uses `type` field, `StateMutation` uses `kind` field
- **declarativeNetRequest for header rules** — never webRequest blocking API
- **Business logic in shared/** — keep components thin, logic testable
- **Shadow DOM for injected UI** — never inject global CSS into host pages
- **Content script bridges only** — no business logic in content scripts

## Files To Know

| File                                     | Purpose                                                         |
| ---------------------------------------- | --------------------------------------------------------------- |
| `src/background/index.ts`                | Message hub — handles all runtime messages, applies mutations   |
| `src/background/storage.ts`              | Typed chrome.storage.local wrapper with subscribe pattern       |
| `src/background/rules-dnr.ts`            | Translates rules → declarativeNetRequest format                 |
| `src/shared/types.ts`                    | All core types: Rule, Group, AppState, MockAction, HeaderAction |
| `src/shared/messages.ts`                 | RuntimeMessage union, sendMessage helper, type guards           |
| `src/shared/constants.ts`                | Storage keys, message types, port names, limits                 |
| `src/shared/matcher.ts`                  | URL/method matching (exact, contains, regex)                    |
| `src/injected/page-mock.ts`              | Patches fetch/XHR in page world, returns mock responses         |
| `src/devtools/panel.tsx`                 | Main DevTools React app with tab routing                        |
| `src/devtools/components/RuleEditor.tsx` | Full CRUD form for rule creation/editing                        |
| `manifest.json`                          | Chrome extension manifest — permissions, entry points           |
| `vite.config.ts`                         | Build config — CRXJS plugin, path aliases, dev server           |
| `tests/setup.ts`                         | Chrome API mocks for all test files                             |

## Files To Never Touch

- `dist/` — build output, auto-generated by Vite + CRXJS
- `release/` — packaged zip artifacts from `npm run package`
- `package-lock.json` — auto-managed by npm (don't manually edit)

## Common Patterns

### Adding a new runtime message

```typescript
// 1. Add type in src/shared/constants.ts
export const MESSAGE_TYPES = {
  // ... existing
  MY_NEW_ACTION: 'MY_NEW_ACTION',
} as const;

// 2. Add to union in src/shared/messages.ts
export type RuntimeMessage =
  | { type: typeof MESSAGE_TYPES.MY_NEW_ACTION; payload: MyPayload }
  // ... existing

// 3. Handle in src/background/index.ts switch
case MESSAGE_TYPES.MY_NEW_ACTION:
  handleMyAction(message.payload)
    .then((result) => sendResponse({ ok: true, value: result }))
    .catch((err) => sendResponse({ ok: false, error: (err as Error).message }));
  return true; // async response
```

### Adding a new rule property

```typescript
// 1. Add to Rule type in src/shared/types.ts
export interface Rule {
  // ... existing
  myNewProp: string;
}

// 2. Update RuleEditor.tsx form to include the field
// 3. Update matcher.ts if it affects matching logic
// 4. Update import-export.ts validation for bundle compatibility
// 5. Add test in tests/shared/
```

### Writing a test with Chrome mocks

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Chrome mocks auto-loaded from tests/setup.ts

describe('myFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does something with storage', async () => {
    chrome.storage.local.get.mockResolvedValue({ appState: mockState });
    const result = await getState();
    expect(result.masterEnabled).toBe(true);
  });
});
```

### Adding a DevTools component

```typescript
// src/devtools/components/MyComponent.tsx
import type { Rule } from '@/shared/types';

interface Props {
  rules: Rule[];
  onAction: (ruleId: string) => void;
}

export function MyComponent({ rules, onAction }: Props): JSX.Element {
  // Component logic — keep thin, delegate to shared/
  return <div>...</div>;
}
```

## Testing

- **Framework**: Vitest + happy-dom (not Jest)
- **Structure**: `tests/` mirrors `src/` directory layout
- **Chrome mocks**: Global setup in `tests/setup.ts` — auto-mocks all chrome.\* APIs
- **Run**: `npm test` (watch mode), `npm run test -- --run` (single pass)
- **Coverage**: V8 provider, text + lcov reporters
- **Targets**: 80%+ coverage for service worker, 90%+ for message handlers
- **Conventions**: Factory functions (`makeMockRule()`) for test data, `describe`/`it` blocks

## Security

- No `eval()` or `new Function()` — ever
- No `<all_urls>` in content_scripts (only in host_permissions for DNR)
- CSP-compliant: no inline scripts, no remote code
- Input validation via type guards before processing any external data
- Shadow DOM isolation for injected UI elements

## Known Gotchas

- **`src/shared/types.ts` and `src/shared/messages.ts` must stay in sync** — adding a message type requires updating both files plus the handler in `background/index.ts`
- **`return true` in message listeners** — forgetting this makes async `sendResponse` fail silently
- **CRXJS HMR quirks** — service worker doesn't auto-reload; manually reload extension after background changes
- **DNR rule ID limits** — IDs must be positive integers; `hashIdForDnr()` in `utils/id.ts` handles conversion from string UUIDs
- **Page-world script runs at `document_start`** — DOM not available, only fetch/XHR patching
- **`exactOptionalPropertyTypes` is ON** — can't assign `undefined` to optional props, must omit the key entirely
- **Content script is bridge only** — never put matching logic or state there; it relays between page world and service worker
- **Test environment is happy-dom, not jsdom** — some browser APIs differ; check happy-dom docs for edge cases
- **Import/export bundles have schema versions** — always validate with `isAppState()` before loading

## Freedom Levels

| MUST follow                            | SHOULD follow                 | CAN customize               |
| -------------------------------------- | ----------------------------- | --------------------------- |
| TypeScript strict mode, no `any`       | Discriminated union messaging | UI component layout         |
| Named exports only                     | Immutable state updates       | DevTools panel styling      |
| `@/` path aliases for cross-dir        | Result objects for errors     | Test factory helpers        |
| Chrome storage typed wrappers          | Type guards for validation    | Utility function signatures |
| Service worker as state hub            | PascalCase components         | Response mock format        |
| declarativeNetRequest (not webRequest) | kebab-case modules            | Capture column choices      |

## AI Interaction Guidelines

- **Interaction modes**: Teaching (Chrome extension concepts) · Efficient (repeated CRUD patterns) · Diagnostic (extension loading failures, message passing bugs)
- **On correction**: Restate as rule, apply consistently, suggest persisting to LEARNED.md
- **On ambiguity**: Check `src/shared/types.ts` and existing patterns first, ask ONE question
- **Adaptive**: Match proficiency level; surface conventions from `.data/skills/` references
- **Debug helper**: Use `window.__phantomMock` console API for runtime inspection

## Skills Reference

> Project-specific conventions live in `.data/skills/chromeExtensionDeveloper/`. Check before making architectural decisions.
> Skills available: **chromeExtensionDeveloper**
>
> Key references:
>
> - `references/code-style.md` — Formatting and naming rules
> - `references/manifest-patterns.md` — Manifest V3 code examples
> - `references/service-worker-patterns.md` — Service worker lifecycle
> - `references/message-passing-guide.md` — Typed message passing
> - `references/security-checklist.md` — Security best practices
> - `references/test-patterns.md` — Vitest + happy-dom patterns
> - `references/common-issues.md` — Chrome extension gotchas

## Sub-Agent Capabilities

> The `chromeExtensionDeveloper` skill supports sub-agent delegation for complex workflows.
> Available sub-agents:
>
> - `agents/code-reviewer.md` — Read-only code audit and quality checks
> - `agents/security-auditor.md` — CSP, permissions, and security analysis
> - `agents/test-writer.md` — Vitest test generation following project patterns
>
> Ensure `Agent` is in allowed-tools when using these skills.
