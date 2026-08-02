# Manifest Patterns — phantom-mock

> Manifest V3 configuration patterns, permission strategies, and content script declarations.

---

## Base Manifest Structure

This mirrors the project's actual `manifest.json` (root of the repo) — keep the two in sync when editing either:

```json
{
  "manifest_version": 3,
  "name": "Phantom Mock",
  "version": "0.7.1",
  "description": "Mock REST API responses and override request/response headers directly from your browser.",
  "permissions": ["declarativeNetRequest", "declarativeNetRequestFeedback", "storage", "cookies"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/service-worker.ts",
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
  "devtools_page": "src/devtools/devtools.html",
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["src/content/index.ts"],
      "run_at": "document_start",
      "all_frames": false
    },
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["src/injected/page-mock.ts"],
      "run_at": "document_start",
      "world": "MAIN",
      "all_frames": false
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Permission Justifications

Every permission MUST have a justification comment in the codebase (see `PRIVACY.md` and `store-assets/SUBMISSION-CHECKLIST.md` for the canonical wording):

| Permission                      | Justification                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `declarativeNetRequest`         | Core feature — implements header-rule overrides at the network layer                      |
| `declarativeNetRequestFeedback` | Powers the Debug tab's live match log (`chrome.declarativeNetRequest.onRuleMatchedDebug`) |
| `storage`                       | Persist rules, groups, storage profiles, and cookie profiles in `chrome.storage.local`    |
| `cookies`                       | Read/write a single cookie on the inspected tab from the Cookies tab                      |
| `<all_urls>` (host permission)  | Inject the mocking script on whichever site the user chooses to mock                      |

There is no `activeTab`, `contextMenus`, or `alarms` permission in this project — mock rules are matched client-side in `injected/page-mock.ts`, not via a browser-action click or context menu, and the service worker does not use alarms.

---

## Content Script Declaration

The two `content_scripts` entries above are the actual, current declaration: an isolated-world bridge (`content/index.ts`) and a MAIN-world fetch/XHR patcher (`injected/page-mock.ts`), both registered statically (not via `chrome.scripting.executeScript`) so they run at `document_start` on every page load.

**Rules**:

- Use `"world": "MAIN"` only for the page-mock script — it needs to patch `window.fetch`/`XMLHttpRequest` before the page's own scripts run
- Keep `run_at: "document_start"` for both entries — later injection would miss requests fired during page load
- Never inject CSS globally — use Shadow DOM (see `content/toast.ts`)

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

Phantom Mock only ever emits `modifyHeaders` dynamic rules (built by `translateToDnrRules()` in `src/background/rules-dnr.ts`) — DNR cannot synthesize a response body, so mock (response-mocking) rules are never expressed as DNR and are instead handled client-side in `src/injected/page-mock.ts`. Do not add `redirect`/`block`/`allowAllRequests` rule types here; they are not part of this project's model.

```json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "requestHeaders": [{ "header": "X-Tenant-Id", "operation": "set", "value": "acme" }]
  },
  "condition": {
    "urlFilter": "api.example.com/endpoint",
    "resourceTypes": ["xmlhttprequest", "main_frame", "script", "stylesheet", "image", "..."]
  }
}
```

`resourceTypes` is deliberately broad (derived from the full `chrome.declarativeNetRequest.ResourceType` enum) — a header must apply to every sub-resource, not just XHR/fetch, or a backend that keys off it can end up in the wrong context for a request that slipped through unheadered.

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
