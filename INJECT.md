# Phantom Mock — Quick Reference

- **Stack**: TypeScript 5.6 strict + React 18 + Vite/CRXJS + Chrome Manifest V3
- **Entry points**: `src/background/index.ts` (SW), `src/devtools/panel.tsx` (UI), `src/injected/page-mock.ts` (fetch/XHR patch)
- **Key dirs**: `src/background/` (state hub), `src/shared/` (types/messages), `src/devtools/` (panel UI), `src/injected/` (page-world)
- **Run**: `npm run dev` / `npm test` / `npm run lint`
- **Patterns**: Discriminated unions for messages, immutable state, typed chrome.storage wrappers, Result objects, `@/` path aliases
- **Never**: `any` type, default exports, webRequest API, eval(), deep relative imports, mutate state in-place
- **Full context**: See [agents.md](agents.md)
