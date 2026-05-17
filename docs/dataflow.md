# Data Flow

The main user-facing pipelines, traced end-to-end.

## Pipeline 1: Create or edit a mock rule

User opens DevTools panel, edits a rule, clicks Save.

```mermaid
sequenceDiagram
    participant User
    participant Panel as panel.tsx
    participant Hook as state-hook.ts
    participant SW as background/index.ts
    participant Store as background/storage.ts
    participant DNR as background/rules-dnr.ts
    participant CS as content/index.ts
    participant PW as injected/page-mock.ts

    User->>Panel: Fill form, click Save
    Panel->>Hook: mutate({ kind: 'upsertRule', rule })
    Hook->>SW: sendMessage(MUTATE_STATE)
    SW->>SW: applyMutation(state, mutation)
    SW->>Store: setState(newState)
    Store-->>SW: storage.onChanged fires
    SW->>DNR: syncDnrRules(newState)
    DNR->>DNR: translateToDnrRules() for header rules
    DNR->>DNR: chrome.declarativeNetRequest.updateDynamicRules()
    SW->>CS: chrome.tabs.sendMessage(RULES_UPDATED)
    CS->>PW: window.postMessage(rules payload)
    PW->>PW: update cache
    SW-->>Hook: respond { ok: true, state }
    Hook-->>Panel: re-render with new state
```

1. **Entry**: `devtools/panel.tsx` — user clicks Save, calls `mutate()` from `useAppState()`
2. **Hook**: `devtools/state-hook.ts::mutate()` — sends `MUTATE_STATE` message via `chrome.runtime.sendMessage()`
3. **Service worker**: `background/index.ts` — `applyMutation()` processes the mutation (upsertRule, deleteRule, toggleRule, etc.) and calls `updateState()`
4. **Storage**: `background/storage.ts::setState()` — writes to `chrome.storage.local`, triggers `onChanged` listener
5. **DNR sync**: `background/rules-dnr.ts::syncDnrRules()` — translates header-type rules to DNR format, calls `chrome.declarativeNetRequest.updateDynamicRules()`
6. **Broadcast**: `background/index.ts::broadcastRulesUpdated()` — sends `RULES_UPDATED` to all tabs via `chrome.tabs.sendMessage()`
7. **Content script**: `content/index.ts` — receives `RULES_UPDATED`, calls `postRulesToPage()` which sends rules via `window.postMessage()`
8. **Page world**: `injected/page-mock.ts` — receives message, updates in-memory `cache` with new rules/groups/masterEnabled

## Pipeline 2: Web page makes a request that matches a mock rule

A website calls `fetch()` or creates an `XMLHttpRequest` to a URL matching an active rule.

```mermaid
sequenceDiagram
    participant Page as Web Page
    participant PW as injected/page-mock.ts
    participant CS as content/index.ts
    participant Toast as content/toast.ts
    participant SW as background/index.ts
    participant Log as background/log.ts
    participant DT as DevTools HitLog

    Page->>PW: fetch('/api/users')
    PW->>PW: findMatch(url, method)
    PW->>PW: specMatches() + isRuleActive()
    PW->>PW: sleep(delayMs)
    PW-->>Page: Return mock Response(body, status, headers)
    PW->>CS: window.postMessage(HIT)
    CS->>Toast: showRuleAppliedToast() (if prefs.showToast)
    CS->>SW: chrome.runtime.sendMessage(MOCK_HIT)
    SW->>Log: recordHit(hit)
    Log->>DT: port.postMessage({ kind: 'hit', hit })
```

1. **Entry**: web page calls `fetch(url)` or `xhr.send()` — the patched version in `injected/page-mock.ts` intercepts
2. **Match**: `findMatch(url, method)` iterates cached rules; `isRuleActive()` checks master + group + rule enabled; `specMatches()` tests URL pattern (exact/contains/regex) and method
3. **Mock**: if matched and action is `mock` — applies `sleep(delayMs)`, constructs `Response` with `statusCode`, `responseBody`, `responseHeaders`, `responseContentType`
4. **Hit emit**: `emitHit()` posts `MockHit` to content script via `window.postMessage()`
5. **Content script**: `content/index.ts` receives hit, optionally shows toast via `showRuleAppliedToast()`, forwards `MOCK_HIT` message to service worker
6. **Log**: `background/log.ts::recordHit()` appends to circular buffer (max `MAX_HIT_LOG_ENTRIES`), broadcasts to all connected DevTools ports
7. **DevTools**: `HitLog` component receives hit via port listener, renders in UI

## Pipeline 3: Capture network traffic and promote to rule

User opens DevTools Capture tab, records traffic, then promotes a captured entry to a mock rule.

```mermaid
sequenceDiagram
    participant Page as Web Page
    participant Network as chrome.devtools.network
    participant DT as devtools/devtools.ts
    participant Session as chrome.storage.session
    participant Hook as capture/use-capture.ts
    participant UI as capture/Capture.tsx
    participant Promote as capture/PromoteToRule.tsx
    participant SW as background/index.ts

    Page->>Network: HTTP request completes
    Network->>DT: onRequestFinished(entry)
    DT->>DT: Extract URL, method, headers, body
    DT->>Session: Append to CAPTURE_BUFFER (debounced)
    Session-->>Hook: storage.onChanged
    Hook-->>UI: entries state update
    UI->>UI: User clicks "Promote to Rule"
    UI->>Promote: Show PromoteToRule dialog
    Promote->>SW: sendMessage(MUTATE_STATE, upsertRule)
    SW->>SW: applyMutation → setState → broadcast
```

1. **Entry**: `devtools/devtools.ts` registers `chrome.devtools.network.onRequestFinished` listener
2. **Capture**: for each completed request, extracts URL, method, status, headers, body; calls `getContent()` for response body
3. **Buffer**: appends `CapturedEntry` to buffer in `chrome.storage.session` (max 100 entries, debounced 150ms)
4. **Hook**: `capture/use-capture.ts::useCapture()` subscribes to session storage changes, updates React state
5. **UI**: `capture/Capture.tsx` renders entries in a filterable grid with domain/subdomain grouping
6. **Promote**: user clicks "Promote to Rule" — `PromoteToRule.tsx` converts `CapturedEntry` fields to a `Rule` with field checkboxes and pattern presets
7. **Save**: promoted rule is sent as `MUTATE_STATE` to service worker, follows Pipeline 1 from step 3 onward
