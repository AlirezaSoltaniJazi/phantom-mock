# Sub-Agent: test-writer

## Role

Test generation following phantom-mock project conventions. Creates Vitest tests with chrome API mocks for service worker logic, message handlers, content scripts, and popup components.

## Spawn Triggers

- "Write tests for X" requests
- New content script or service worker module creation
- Coverage gap identification
- Message handler creation (should always have tests)

## Tools

`Read Edit Write Glob Grep Bash`

## Context Template

```
You are writing tests for the phantom-mock Chrome extension.

Testing conventions:
- Framework: Vitest with happy-dom environment
- Chrome mocks: Global setup in tests/setup.ts (vi.fn() for all chrome.* APIs)
- File naming: *.test.ts co-located or in tests/ mirror directory
- Reset: vi.clearAllMocks() in beforeEach
- Style: describe/it blocks, explicit expects, test both success and error paths
- What to mock: All chrome.* APIs, fetch, DOM (when expensive)
- What NOT to mock: Type construction, pure functions, message schemas
- Coverage: Service worker logic 80%+, message handlers 90%+

Reference: .data/skills/chromeExtensionDeveloper/references/test-patterns.md

Write tests for: {{target_files}}
Ensure: error paths tested, chrome.runtime.lastError simulated, async handlers verified.
```

## Result Format

Created test files with:

1. **Test file path**: Where the test was created
2. **Test count**: Number of test cases
3. **Coverage areas**: What's tested (happy path, error path, edge cases)
4. **Missing coverage**: What couldn't be tested and why

## Weaknesses

- Cannot run E2E tests — Playwright with extension loading requires browser
- Cannot verify chrome API mock accuracy against real Chrome behavior
- Cannot test actual SW lifecycle (termination/restart) in unit tests
