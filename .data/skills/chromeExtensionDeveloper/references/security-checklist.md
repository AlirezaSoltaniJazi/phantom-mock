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

| Permission                      | Verify                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `declarativeNetRequest`         | Only used for declared mock/redirect rules                |
| `declarativeNetRequestFeedback` | Only used for debugging UI — consider making optional     |
| `storage`                       | Data stored is non-sensitive, validated before write       |
| `activeTab`                     | Only accessed on user gesture (click/keyboard shortcut)    |
| `contextMenus`                  | Menu items have clear, non-misleading labels              |
| `alarms`                        | Alarm intervals are reasonable (>=1 minute)               |
| `tabs`                          | NOT used if `activeTab` suffices — justify if present     |

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

- [ ] All incoming messages validated with type guard before processing
- [ ] Unknown message types rejected with error response
- [ ] `sender.id` verified matches own extension ID for internal messages
- [ ] External messages (`externally_connectable`) restricted to specific origins
- [ ] No sensitive data in message payloads sent to content scripts
- [ ] Port names validated on connection

### Message Validation Pattern

```typescript
function isValidMessage(message: unknown): message is ExtensionMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof (message as { type: unknown }).type === 'string' &&
    Object.values(MESSAGE_TYPES).includes(
      (message as { type: string }).type as MessageType,
    )
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Verify sender is our extension
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  // Validate message shape
  if (!isValidMessage(message)) {
    sendResponse({ success: false, error: 'Invalid message format' });
    return false;
  }

  // Process validated message...
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
