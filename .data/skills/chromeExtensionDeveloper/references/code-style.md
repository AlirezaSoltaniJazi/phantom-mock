# TypeScript Code Style — phantom-mock

> Import order, TypeScript conventions, naming, and formatting rules with full examples.

---

## Import Order

Four groups, separated by blank lines. Auto-sorted within each group:

```typescript
// 1. Node/Chrome built-ins (rare in extension code)
import path from 'node:path';

// 2. External packages
import { crx } from '@crxjs/vite-plugin';

// 3. Path alias imports (@/)
import { MESSAGE_TYPES } from '@/shared/constants';
import type { AppState, Rule } from '@/shared/types';
import { sendMessage } from '@/shared/messages';

// 4. Relative imports (only within same feature directory)
import { RuleEditor } from './components/RuleEditor';
```

**Rules**:

- `@/` maps to `src/` — use for all cross-directory imports
- Relative imports (`./`) only within the same feature directory
- Never deep relative imports (`../../`) — use `@/` alias
- Type-only imports use `import type { X }` — never mix value and type imports
- Never use wildcard imports (`import * as X`)

---

## TypeScript Strictness

`tsconfig.json` must include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

## Type Patterns

```typescript
// ✅ Correct — explicit return types on exports
export async function getState(): Promise<AppState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.APP_STATE);
  const raw = result[STORAGE_KEYS.APP_STATE];
  if (!isAppState(raw)) {
    const initial = defaultState();
    await setState(initial);
    return initial;
  }
  return migrate(raw);
}

// ✅ Correct — discriminated union for messages (`type` field, SCREAMING_SNAKE_CASE)
export type RuntimeMessage =
  | { type: typeof MESSAGE_TYPES.GET_STATE }
  | { type: typeof MESSAGE_TYPES.MUTATE_STATE; mutation: StateMutation };

// ✅ Correct — result type for fallible operations (this project's actual shape)
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// ❌ Wrong — any type
function handleMessage(message: any): any { ... }

// ❌ Wrong — no return type on export
export async function getState() { ... }

// ❌ Wrong — non-discriminated union
type Message = { rule?: Rule; ruleId?: string; status?: string };
```

---

## Naming Conventions

| Category                   | Style                                                                                                                                                                           | Examples                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Files (modules)            | `kebab-case.ts`                                                                                                                                                                 | `rules-dnr.ts`, `import-export.ts`, `group-notify.ts`                             |
| Files (components)         | `PascalCase.tsx`                                                                                                                                                                | `RuleEditor.tsx`, `RulesTable.tsx`                                                |
| Interfaces                 | `PascalCase`                                                                                                                                                                    | `Rule`, `Group`, `AppState`, `MockAction`                                         |
| Type aliases               | `PascalCase`                                                                                                                                                                    | `RuleAction`, `StateMutation`, `UrlMatchType`                                     |
| `as const` value objects   | `SCREAMING_SNAKE_CASE`                                                                                                                                                          | `MESSAGE_TYPES`, `STORAGE_KEYS`, `PORT_NAMES` (project uses these, not TS `enum`) |
| Discriminant string values | `SCREAMING_SNAKE_CASE` for message `type` (`GET_STATE`); lowerCamelCase for mutation `kind` (`upsertRule`); lowercase for action/match `kind` (`'mock'`, `'header'`, `'exact'`) | see `shared/constants.ts`, `shared/messages.ts`, `shared/types.ts`                |
| Functions                  | `camelCase`                                                                                                                                                                     | `getState`, `syncDnrRules`, `translateToDnrRules`                                 |
| Private funcs              | `camelCase` (no prefix)                                                                                                                                                         | Internal to module — not exported = private                                       |
| Constants                  | `SCREAMING_SNAKE_CASE`                                                                                                                                                          | `MAX_RULES`, `STORAGE_KEYS`, `MESSAGE_TYPES`                                      |
| Variables                  | `camelCase`                                                                                                                                                                     | `ruleCount`, `masterEnabled`, `currentTab`                                        |
| Boolean vars               | `is/has/should` prefix                                                                                                                                                          | `isActive`, `isRuleActive`, `shouldInject`                                        |

Note: this project has no TypeScript `enum` anywhere in `src/` — discriminants are string-literal unions backed by `as const` objects (see `HTTP_METHODS`, `MESSAGE_TYPES`), not `enum RuleType { ... }`.

---

## Export Style

```typescript
// ✅ Correct — named exports
export function getState(): Promise<AppState> { ... }
export type { Rule, Group, AppState };
export { STORAGE_KEYS, MESSAGE_TYPES };

// ❌ Wrong — default exports
export default function getState() { ... }
export default class StateManager { ... }
```

---

## Error Handling

```typescript
// ✅ Correct — Result type, specific errors (real pattern from
// src/shared/import-export.ts)
export function validateRule(value: unknown, index: number, groupIds: Set<string>): Result<Rule> {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: `rules[${index}]: expected an object` };
  }
  // ...field-by-field validation...
  return { ok: true, value: rule };
}

// Callers narrow on `.ok`:
const result = validateRule(raw, 0, groupIds);
if (!result.ok) {
  console.warn(result.error);
} else {
  useRule(result.value);
}

// ❌ Wrong — throwing for expected/validatable failures
export function validateRule(value: unknown): Rule {
  if (typeof value !== 'object') {
    throw new Error('Invalid rule'); // DON'T THROW for expected validation failures
  }
  ...
}
```

---

## File Organization

Each module follows this structure:

```typescript
/**
 * One-line module description.
 */

// Type imports
import type { Rule, Result } from '@/shared/types';

// Value imports
import { STORAGE_KEYS } from '@/shared/constants';
import { sendMessage } from '@/shared/messages';

// Constants
const MAX_RETRY_COUNT = 3;

// Exported functions (public API)
export function buildExportBundle(state: AppState): ExportBundle {
  ...
}

// Internal helpers (not exported) — e.g. `validateRule()` in
// src/shared/import-export.ts is a real example: called only by the
// exported `validateBundle()`, never exported itself
function validateRule(value: unknown, index: number, groupIds: Set<string>): Result<Rule> {
  ...
}
```

---

## Formatting (Prettier)

This mirrors the project's actual `.prettierrc` (root of the repo):

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```
