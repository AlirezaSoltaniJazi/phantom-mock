# Security Checklist — phantom-mock

> Per-permission, per-content-script, and per-CSP verification checklists.

---

## Permission Audit Checklist

For every permission in `manifest.json`:

- [ ] Permission is necessary for core functionality (not "nice to have")
- [ ] Justification is documented in code or manifest comments
- [ ] No broader alternative exists (e.g., `activeTab` over `tabs`)
- [ ] Optional permissions used for non-critical features
- [ ] `host_permissions` are as narrow as possible (specific origins over `<all_urls>`)

### Per-Permission Verification

| Permission                      | Verify                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declarativeNetRequest`         | Only used for `header`-kind rules (`modifyHeaders`) — never `redirect`/`block`; mock (response-body) rules are handled client-side, not through DNR |
| `declarativeNetRequestFeedback` | Only used for the Debug tab's live match log (`onRuleMatchedDebug`) — consider making optional                                                      |
| `storage`                       | Data stored is non-sensitive, validated before write                                                                                                |
| `cookies`                       | Actually used in this project — tab-scoped read/write for the Cookies tab (`background/cookies.ts`), guarded by `tabIdMatchesSender()`              |
| `<all_urls>` (host permission)  | Present and intentional in this project (see `PRIVACY.md`) — don't flag or suggest narrowing it                                                     |

`activeTab`, `contextMenus`, `alarms`, and `tabs` are **not** in this project's `manifest.json` today — the rows below are generic guidance to apply only if a future feature actually adds one of them:

| Permission     | Verify                                                  |
| -------------- | ------------------------------------------------------- |
| `activeTab`    | Only accessed on user gesture (click/keyboard shortcut) |
| `contextMenus` | Menu items have clear, non-misleading labels            |
| `alarms`       | Alarm intervals are reasonable (>=1 minute)             |
| `tabs`         | NOT used if `activeTab` suffices — justify if present   |

---

## Content Script Security Checklist

- [ ] Content script runs in `ISOLATED` world (default) unless MAIN world is justified
- [ ] No global namespace pollution (all code wrapped in IIFE or module)
- [ ] Shadow DOM used for all injected UI elements
- [ ] No inline event handlers in injected HTML
- [ ] All user input sanitized before DOM insertion (use `textContent`, not `innerHTML`)
- [ ] Message origin validated in `onMessage` listener
- [ ] No sensitive data leaked to page context
- [ ] `MutationObserver` cleaned up on disconnect

### DOM Injection Rules

```typescript
// ✅ Safe — Shadow DOM isolation
const host = document.createElement('phantom-mock-root');
const shadow = host.attachShadow({ mode: 'closed' });
shadow.innerHTML = `<style>/* scoped styles */</style>`;
document.body.appendChild(host);

// ❌ Unsafe — global DOM pollution
document.body.innerHTML += '<div class="phantom-mock">...</div>';

// ✅ Safe — textContent for user data
const label = document.createElement('span');
label.textContent = userInput; // Safe — no HTML parsing

// ❌ Unsafe — innerHTML with user data
element.innerHTML = `<span>${userInput}</span>`; // XSS risk
```

---

## Content Security Policy Checklist

- [ ] `script-src 'self'` — no remote scripts, no inline, no eval
- [ ] `object-src 'self'` — no plugins/embeds from external sources
- [ ] No `'unsafe-eval'` in CSP (MV3 forbids it anyway)
- [ ] No `'unsafe-inline'` in CSP
- [ ] No remote code loading (all code bundled locally)
- [ ] Dynamic imports only from extension bundle

### CSP Configuration

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**MV3 enforced restrictions** (cannot be overridden):

- No `eval()`, `new Function()`, or `setTimeout/setInterval` with strings
- No inline scripts in HTML pages
- No remotely hosted code

---

## Message Security Checklist

- [ ] All incoming messages validated with a type guard before processing (`isRuntimeMessage()`)
- [ ] Unknown message types rejected (the `switch` in `service-worker.ts` falls through to `default: return false`)
- [ ] Extension-context senders verified via `isPrivilegedSender()` before allowing state mutation (see below — this project checks `sender.url`/`sender.origin`, not `sender.id`)
- [ ] Tab-scoped requests (cookie get/set/remove) verified via `tabIdMatchesSender()` so one tab's content script can't act on another tab's cookies
- [ ] External messages (`externally_connectable`) restricted to specific origins — N/A today, this project doesn't declare `externally_connectable`
- [ ] No sensitive data in message payloads sent to content scripts
- [ ] Port names validated on connection (`port.name !== PORT_NAMES.HIT_LOG` etc. — see `background/log.ts`)

### Message Validation Pattern (actual project pattern)

```typescript
// src/background/service-worker.ts

// Extension contexts (popup, options, DevTools panel) report sender.url
// starting with chrome-extension://<our-id>/. Content scripts on host pages
// report the page's http(s):// URL. Note this does NOT check `sender.id` —
// `sender.tab` can be populated even for a trusted DevTools-panel sender (it
// carries the *inspected* tab), so a naive `sender.tab === undefined` or
// `sender.id !== chrome.runtime.id` check is not what this project uses.
export function isPrivilegedSender(sender: chrome.runtime.MessageSender): boolean {
  const ourPrefix = chrome.runtime.getURL('');
  const url = sender.url ?? sender.origin ?? '';
  return url.startsWith(ourPrefix);
}

// Cross-tab cookie access guard — a compromised page's content script could
// otherwise call chrome.runtime.sendMessage with any tabId and ask us to
// read/write cookies on a totally unrelated tab.
export function tabIdMatchesSender(
  sender: chrome.runtime.MessageSender,
  requestedTabId: number
): boolean {
  if (isPrivilegedSender(sender)) return true;
  return sender.tab?.id === requestedTabId;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRuntimeMessage(message)) return false; // type guard first

  switch (message.type) {
    case MESSAGE_TYPES.MUTATE_STATE:
      if (!isPrivilegedSender(sender)) {
        sendResponse({ ok: false, error: 'MUTATE_STATE is restricted to extension contexts' });
        return false;
      }
      // ...process...
      return true;
    default:
      return false; // unknown/unhandled types are silently not responded to
  }
});
```

---

## Web Accessible Resources Checklist

- [ ] Only files needed by content scripts are exposed
- [ ] Resources restricted to specific URL patterns (not `<all_urls>` unless necessary)
- [ ] No source maps exposed in production builds
- [ ] No sensitive configuration files exposed
- [ ] Extension-specific prefixed filenames to avoid collisions

---

## Storage Security Checklist

- [ ] No credentials, tokens, or API keys in `chrome.storage.sync` (syncs to Google)
- [ ] Sensitive data (if any) only in `chrome.storage.local`
- [ ] Input validated and sanitized before storage write
- [ ] Storage quota monitored (sync: 100KB total, local: 10MB)
- [ ] Migration logic handles corrupt/invalid data gracefully

---

## Chrome Web Store Compliance

- [ ] All permissions justified in Chrome Web Store listing
- [ ] Privacy policy URL provided if data is collected
- [ ] No deceptive functionality or hidden behavior
- [ ] Extension name and description accurately reflect functionality
- [ ] No trademark infringement in branding or description
- [ ] Single purpose clearly defined and documented
