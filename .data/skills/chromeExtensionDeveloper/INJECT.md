# chromeExtensionDeveloper — Quick Reference

<!-- INJECT.md is always loaded into the agent's context (50-150 tokens max).
     It serves as a hallucination firewall — a compact cheat-sheet of the
     most critical facts the agent needs to know at all times. -->

- **FIRST**: Read [LEARNED.md](LEARNED.md) — corrections and preferences from previous sessions
- **Stack**: Chrome MV3, TypeScript 6+ strict, Vite + CRXJS, Vitest, ESLint, Prettier
- **Purpose**: Mock REST API responses via client-side fetch/XHR patching (`injected/page-mock.ts`) and override headers via declarativeNetRequest, managed primarily through a DevTools panel
- **Source**: `src/` — background (service worker), content (bridge scripts), injected (page-world patching), devtools (primary UI), popup (quick toggle), shared (types/messages), utils (helpers)
- **Key rules**: Typed messages (discriminant union); `declarativeNetRequest` for header rules only, never webRequest; Shadow DOM for injected UI; `@/` path aliases; no `any`; named exports only; `chrome.storage.local` with typed wrappers
- **Never**: `eval()`/`new Function()`, `any` type, default exports, raw chrome.storage, webRequest blocking, global CSS injection, polling in SW — note the project's own `<all_urls>` host permission IS intentional and justified (see PRIVACY.md), don't flag or narrow it
- **Sub-agents**: code-reviewer (read-only audit), security-auditor (CSP/permissions), test-writer (Vitest generation)
- **Self-learning**: On correction -> write to LEARNED.md. On ambiguity -> check LEARNED.md first.
- **Full guide**: See [SKILL.md](SKILL.md) for conventions and [references/](references/) for detailed examples
