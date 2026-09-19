# Common Issues — phantom-mock

> Troubleshooting guide for frequent Chrome extension development pitfalls.

---

## Service Worker Issues

### SW Terminates Unexpectedly

**Symptom**: Background logic stops working, alarms don't fire, state is lost.

**Cause**: MV3 service workers have a 30-second idle timeout (5 minutes with active events).

**Fix**:

- Store all state in `chrome.storage.local` — never in memory variables
- Use `chrome.alarms` instead of `setTimeout`/`setInterval`
- Re-sync state in `chrome.runtime.onStartup` listener

### Event Listeners Not Firing After Restart

**Symptom**: Messages not received, alarms ignored after browser restart.

**Cause**: Event listeners registered inside `async` functions or conditionally.

**Fix**: Register ALL event listeners synchronously at the top level of the service worker.

```typescript
// ✅ Top level — always registered
chrome.runtime.onMessage.addListener(handleMessage);

// ❌ Inside async — might miss events
async function init() {
  chrome.runtime.onMessage.addListener(handleMessage); // TOO LATE
}
```

---

## Content Script Issues

### Content Script Not Injecting

**Symptom**: Content script code doesn't run on target pages.

**Causes & Fixes**:

1. **Manifest `matches` pattern wrong** — test patterns at https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
2. **`run_at` timing** — use `document_idle` (default) or `document_end` for most cases
3. **Extension not reloaded** — after manifest changes, reload extension in `chrome://extensions`
4. **Page loaded before extension** — already-open tabs need refresh after install

### Content Script Styles Leaking

**Symptom**: Extension CSS affects the host page, or page CSS affects extension UI.

**Fix**: Always use Shadow DOM for injected UI:

```typescript
const host = document.createElement('phantom-mock-root');
const shadow = host.attachShadow({ mode: 'closed' });
// All styles go inside shadow — fully isolated
```

### `window` Access in ISOLATED World

**Symptom**: Cannot access page's JavaScript variables or functions.

**Fix**: Use `"world": "MAIN"` in manifest or `chrome.scripting.executeScript` with `world: 'MAIN'`. Be cautious — MAIN world shares the page's context.

---

## Message Passing Issues

### `sendMessage` Returns `undefined`

**Symptom**: Response from background is always `undefined`.

**Causes**:

1. **Async handler without `return true`** — if handler is async, listener MUST return `true`
2. **No listener registered** — service worker terminated before message arrived
3. **Multiple listeners** — only one can `sendResponse`

```typescript
// ✅ Return true for async handlers
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleAsync(msg).then(sendResponse);
  return true; // CRITICAL — keeps channel open
});
```

### "Could not establish connection" Error

**Symptom**: `chrome.runtime.sendMessage` throws connection error.

**Causes**:

1. **Extension reloaded** — content scripts from old version are orphaned
2. **Service worker not running** — message arrives before SW wakes up
3. **Tab closed** — attempting to send to a closed tab

**Fix**: Always wrap in try/catch:

```typescript
try {
  const response = await chrome.runtime.sendMessage(message);
} catch {
  // Extension context invalidated — reload page or fail gracefully
}
```

---

## Storage Issues

### Storage Quota Exceeded

**Symptom**: `chrome.storage.local.set` fails silently or throws.

**Fix**:

- `sync` quota: 100KB total, 8KB per item — use for preferences only
- `local` quota: 10MB — use for rule data
- Monitor with `chrome.storage.local.getBytesInUse()`

### Storage Data Corruption After Update

**Symptom**: Extension breaks after update due to changed data schema.

**Fix**: Version your storage schema and migrate additively. This project does **not** gate
migration on `chrome.runtime.onInstalled`'s `reason === 'update'` — there is no `migrateStorage()`
function. Instead, `background/storage.ts`'s `migrate()` runs additively on **every** `getState()`
read (so it self-heals regardless of how state got out of date), keyed on `CURRENT_SCHEMA_VERSION`
in `shared/types.ts`:

```typescript
// src/background/storage.ts (real pattern)
export async function getState(): Promise<AppState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.APP_STATE);
  const raw = result[STORAGE_KEYS.APP_STATE];
  if (!isAppState(raw)) {
    const initial = defaultState();
    await setState(initial);
    return initial;
  }
  return migrate(raw); // fills in missing/legacy fields on every read
}
```

---

## Build Issues

### CRXJS Hot Reload Not Working

**Symptom**: Changes don't reflect in the extension during development.

**Fixes**:

1. Check Vite dev server is running
2. Verify CRXJS plugin version matches Vite version
3. Service worker changes often require manual reload at `chrome://extensions`
4. Content script changes require page refresh

### TypeScript Errors with Chrome API Types

**Symptom**: `chrome.*` APIs show type errors or are unrecognized.

**Fix**: This project already depends on `@types/chrome` (see `package.json`). If types are missing on a fresh clone, reinstall:

```bash
npm install -D @types/chrome
```

`tsconfig.json` already includes it via the short name:

```json
{
  "compilerOptions": {
    "types": ["chrome", "vitest/globals"]
  }
}
```

---

## DeclarativeNetRequest Issues

### Rules Not Matching

**Symptom**: Requests pass through without being intercepted.

**Debug steps**:

1. Check `chrome.declarativeNetRequest.getDynamicRules()` — are rules registered?
2. Verify `urlFilter` syntax — uses Chrome's filter syntax, not regex
3. Check `resourceTypes` — must include the request type (e.g., `xmlhttprequest`)
4. Check rule priority — higher priority rules override lower ones
5. Enable `declarativeNetRequestFeedback` permission for `onRuleMatchedDebug`

### Dynamic Rules Limit

**Limit**: `chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES` — check the constant in the
`@types/chrome` version this project pins (`package.json`), since Chrome has raised this limit
over time (it is 30000 in the currently-installed `@types/chrome`, not the older 5000 figure).
This project's own `MAX_RULES` (`shared/constants.ts`) caps total rules (mock + header) at 4000,
well under either figure.

**Fix**: Manage rule count, implement pagination or rule consolidation.

---

## Debugging Tips

1. **Service worker console**: `chrome://extensions` -> extension details -> "Inspect views: service worker"
2. **Content script console**: Regular DevTools console on the target page (filter by extension name)
3. **Popup DevTools**: Right-click popup -> "Inspect"
4. **Storage viewer**: DevTools -> Application -> Extension Storage
5. **Network interception**: DevTools -> Network tab, filter by "declarativeNetRequest" matched rules
