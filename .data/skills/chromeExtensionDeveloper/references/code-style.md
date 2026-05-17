# TypeScript Code Style — phantom-mock

> Import order, TypeScript conventions, naming, and formatting rules with full examples.

---

## Import Order

Four groups, separated by blank lines. Auto-sorted within each group:

```typescript
// 1. Node/Chrome built-ins (rare in extension code)
import type { Runtime } from 'chrome';

// 2. External packages
import { crx } from '@anthropic-ai/crxjs-vite-plugin';

// 3. Path alias imports (@/)
import { MESSAGE_TYPES } from '@/shared/messages';
import type { MockRule, ExtensionState } from '@/shared/types';
import { STORAGE_KEYS } from '@/shared/constants';

// 4. Relative imports (only within same feature directory)
import { renderRuleList } from './components/rule-list';
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
export async function getRules(): Promise<MockRule[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.RULES);
  return result[STORAGE_KEYS.RULES] ?? [];
}

// ✅ Correct — discriminated union for messages
export interface AddRuleMessage {
  type: 'ADD_RULE';
  payload: { rule: MockRuleInput };
}

// ✅ Correct — result type for fallible operations
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ❌ Wrong — any type
function handleMessage(message: any): any { ... }

// ❌ Wrong — no return type on export
export async function getRules() { ... }

// ❌ Wrong — non-discriminated union
type Message = { rule?: MockRule; ruleId?: number; status?: string };
```

---

## Naming Conventions

| Category         | Style                  | Examples                                                |
| ---------------- | ---------------------- | ------------------------------------------------------- |
| Files (modules)  | `kebab-case.ts`        | `mock-rule.ts`, `rule-manager.ts`, `storage-helper.ts`  |
| Files (components)| `PascalCase.tsx`      | `RuleList.tsx`, `MockEditor.tsx`                        |
| Interfaces       | `PascalCase`           | `MockRule`, `MessagePayload`, `ExtensionState`          |
| Type aliases     | `PascalCase`           | `RuleAction`, `MessageType`, `StorageKey`               |
| Enums            | `PascalCase`           | `RuleType`, `ActionKind`                                |
| Enum values      | `SCREAMING_SNAKE`      | `RuleType.REDIRECT`, `RuleType.BLOCK`                   |
| Functions        | `camelCase`            | `addRule`, `handleMessage`, `syncRules`                  |
| Private funcs    | `camelCase` (no prefix)| Internal to module — not exported = private             |
| Constants        | `SCREAMING_SNAKE_CASE` | `MAX_RULES`, `STORAGE_KEYS`, `MESSAGE_TYPES`            |
| Variables        | `camelCase`            | `ruleCount`, `isEnabled`, `currentTab`                  |
| Boolean vars     | `is/has/should` prefix | `isActive`, `hasPermission`, `shouldInject`             |

---

## Export Style

```typescript
// ✅ Correct — named exports
export function addRule(rule: MockRuleInput): Promise<Result<MockRule>> { ... }
export type { MockRule, MockRuleInput };
export { STORAGE_KEYS, MESSAGE_TYPES };

// ❌ Wrong — default exports
export default function addRule() { ... }
export default class RuleManager { ... }
```

---

## Error Handling

```typescript
// ✅ Correct — Result type, specific errors
export async function addRule(
  input: MockRuleInput,
): Promise<Result<MockRule>> {
  try {
    const rules = await getRules();

    if (rules.length >= MAX_RULES) {
      return { success: false, error: `Maximum ${MAX_RULES} rules reached` };
    }

    const newRule = createRule(input);
    await setRules([...rules, newRule]);
    return { success: true, data: newRule };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ❌ Wrong — throwing for expected failures
export async function addRule(input: MockRuleInput): Promise<MockRule> {
  const rules = await getRules();
  if (rules.length >= MAX_RULES) {
    throw new Error('Too many rules'); // DON'T THROW
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
import type { MockRule, Result } from '@/shared/types';

// Value imports
import { STORAGE_KEYS } from '@/shared/constants';
import { sendMessage } from '@/shared/messages';

// Constants
const MAX_RETRY_COUNT = 3;

// Types (local to this module)
interface RuleManagerState {
  rules: MockRule[];
  syncing: boolean;
}

// Exported functions (public API)
export async function addRule(input: MockRuleInput): Promise<Result<MockRule>> {
  ...
}

export async function removeRule(ruleId: number): Promise<Result<void>> {
  ...
}

// Internal helpers (not exported)
function validateRule(input: MockRuleInput): string | null {
  ...
}
```

---

## Formatting (Prettier)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 80,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```
