# Getting Started

## Prerequisites

- Node.js 18+ (CI tests on Node 18 and 20)
- npm (ships with Node)
- Chrome or Chromium-based browser (for loading the extension)

## Install

```bash
git clone <repo-url>
cd phantom-mock
npm install
```

Husky pre-commit hooks are installed automatically via the `prepare` script.

## Dev (hot-reload)

```bash
npm run dev
```

Starts Vite dev server on port 5173 with HMR on port 5174. Load the extension:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory
4. The "Phantom Mock" panel appears in DevTools; the popup is available from the toolbar icon

Changes to source files hot-reload automatically. If you change `manifest.json`, restart the dev server.

## Build (production)

```bash
npm run build
```

Outputs to `dist/`. The output is a ready-to-load Chrome extension.

## Package (release zip)

```bash
npm run package
```

Builds and creates a `.zip` in `release/` for Chrome Web Store upload.

## Test

```bash
npm test                  # Run all tests once
npm run test:coverage     # Run with coverage report (text + lcov)
```

Tests use Vitest with happy-dom. Test files live in `tests/` and follow the pattern `tests/**/*.test.ts(x)`. Setup is in `tests/setup.ts`.

## Lint / format / typecheck

```bash
npm run lint              # ESLint (src + tests)
npm run format            # Prettier --write
npm run format:check      # Prettier --check (CI mode)
npm run typecheck         # tsc --noEmit
```

All three checks run in CI (`.github/workflows/ci.yml`). The pre-commit hook runs ESLint + Prettier on staged files via lint-staged.

## Security audit

```bash
npm run audit             # npm audit --omit=dev --audit-level=high
```

Also runs weekly via `.github/workflows/security-audit.yml`.

## Version bumps

```bash
npm run bump:patch        # 0.1.0 → 0.1.1
npm run bump:minor        # 0.1.0 → 0.2.0
npm run bump:major        # 0.1.0 → 1.0.0
```

These update `package.json` and `manifest.json` versions in sync.

## Project layout

```
phantom-mock/
├── src/
│   ├── background/       # Service worker — state, DNR rules, hit log
│   ├── content/           # Content script — message bridge, toast
│   ├── injected/          # Page-world script — fetch/XHR patching
│   ├── devtools/          # DevTools panel UI (React)
│   │   ├── components/    # Rule editor, rules table, hit log, settings, JSON views
│   │   └── capture/       # Network capture tab + promote-to-rule
│   ├── popup/             # Browser-action popup
│   ├── shared/            # Types, messages, matcher, constants, prefs, import/export
│   └── utils/             # ID generation
├── tests/                 # Vitest test files mirroring src/ structure
├── public/                # Static assets (extension icons)
├── store-assets/          # Chrome Web Store listing assets
├── scripts/               # Build/utility scripts
├── dist/                  # Build output (git-ignored)
├── release/               # Packaged .zip (git-ignored)
├── manifest.json          # Chrome Manifest V3 configuration
├── vite.config.ts         # Vite + CRXJS build config
├── vitest.config.ts       # Vitest test runner config
├── tsconfig.json          # TypeScript configuration (strict)
├── package.json           # Dependencies, scripts, lint-staged config
├── .prettierrc            # Prettier config (single quotes, 100 chars)
└── .github/
    └── workflows/         # CI, release, security audit, auto-assign
```
