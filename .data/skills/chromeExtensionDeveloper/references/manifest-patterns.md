# Manifest Patterns — phantom-mock

> Manifest V3 configuration patterns, permission strategies, and content script declarations.

---

## Base Manifest Structure

```json
{
  "manifest_version": 3,
  "name": "Phantom Mock",
  "version": "1.0.0",
  "description": "Mock URLs and intercept HTTP requests right from your browser.",
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "storage",
    "activeTab",
    "contextMenus",
    "alarms"
  ],
  "host_permissions": [],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png"
    }
  },
  "icons": {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  },
  "content_scripts": [],
  "web_accessible_resources": [],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Permission Justifications

Every permission MUST have a justification comment in the codebase:

| Permission                        | Justification                                           |
| --------------------------------- | ------------------------------------------------------- |
| `declarativeNetRequest`           | Core feature — redirect/block/modify HTTP requests       |
| `declarativeNetRequestFeedback`   | Show matched rules in popup for debugging                |
| `storage`                         | Persist mock rules and user preferences                  |
| `activeTab`                       | Access current tab URL for rule suggestions              |
| `contextMenus`                    | Right-click to create mock rule for current page         |
| `alarms`                          | Service worker persistence for rule expiration timers    |

---

## Content Script Declaration (When Needed)

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "css": [],
      "run_at": "document_idle",
      "world": "ISOLATED"
    }
  ]
}
```

**Rules**:
- Prefer `chrome.scripting.executeScript` for conditional injection
- Use `"world": "ISOLATED"` unless MAIN world access is required
- Set `run_at` to `document_idle` unless early DOM access is critical
- Never inject CSS globally — use Shadow DOM

---

## Web Accessible Resources (Minimal)

```json
{
  "web_accessible_resources": [
    {
      "resources": ["content-styles.css"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

**Rules**:
- Only expose files that content scripts absolutely need
- Never expose source maps in production
- Restrict `matches` to specific origins when possible

---

## DeclarativeNetRequest Rule Structure

```json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "redirect",
    "redirect": {
      "url": "https://mock-server.local/api/response.json"
    }
  },
  "condition": {
    "urlFilter": "api.example.com/endpoint",
    "resourceTypes": ["xmlhttprequest", "main_frame"]
  }
}
```

**Rule types for phantom-mock**:
- `redirect` — redirect request to mock URL
- `block` — block request entirely
- `modifyHeaders` — modify request/response headers
- `allowAllRequests` — bypass other rules for specific URLs

---

## Optional Permissions Strategy

Use `optional_permissions` for features that not all users need:

```json
{
  "optional_permissions": ["tabs", "webNavigation"],
  "optional_host_permissions": ["*://*.example.com/*"]
}
```

Request at runtime with `chrome.permissions.request()`.
