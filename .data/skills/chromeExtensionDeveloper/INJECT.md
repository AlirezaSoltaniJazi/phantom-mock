# chromeExtensionDeveloper — Quick Reference

<!-- INJECT.md is always loaded into the agent's context (50-150 tokens max).
     It serves as a hallucination firewall — a compact cheat-sheet of the
     most critical facts the agent needs to know at all times. -->

- **FIRST**: Read [LEARNED.md](LEARNED.md) — corrections and preferences from previous sessions
- **Stack**: Chrome MV3, TypeScript 5+ strict, Vite + CRXJS, Vitest, ESLint, Prettier
- **Purpose**: Mock URLs and intercept HTTP requests via declarativeNetRequest
- **Source**: `src/` — background (service worker), content (scripts), popup (UI), shared (types/messages)
- **Key rules**: Typed messages (discriminant union); `declarativeNetRequest` not webRequest; Shadow DOM for injected UI; `@/` path aliases; no `any`; named exports only; `chrome.storage.local` with typed wrappers
- **Never**: `eval()`/`new Function()`, `any` type, default exports, raw chrome.storage, webRequest blocking, global CSS injection, polling in SW, broad `<all_urls>` permissions
- **Sub-agents**: code-reviewer (read-only audit), security-auditor (CSP/permissions), test-writer (Vitest generation)
- **Self-learning**: On correction -> write to LEARNED.md. On ambiguity -> check LEARNED.md first.
- **Full guide**: See [SKILL.md](SKILL.md) for conventions and [references/](references/) for detailed examples
