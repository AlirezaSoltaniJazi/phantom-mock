# Changelog

All notable changes to Phantom Mock are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0]

### Added

- Initial scaffold of the Phantom Mock Chrome MV3 extension.
- Response mocking for REST APIs (fetch + XMLHttpRequest) via an injected
  page-world script, with URL match types `exact`, `contains`, and `regex`
  and per-method filtering.
- Per-rule controls for status code, response delay, response body,
  content-type, response headers, and an "log overrides to panel" flag.
- Header overwrite rules implemented via `chrome.declarativeNetRequest`
  dynamic rules — set/append/remove on request and response headers,
  scoped to `xmlhttprequest` resource type.
- Group management with cascading enable/disable for all rules inside.
- DevTools panel "Phantom Mock" with Rules, Editor, Hit Log, and Settings
  tabs.
- Popup with master switch and per-group / per-rule quick toggles.
- Import / export of rule sets as JSON with three merge strategies
  (replace, merge-by-id, append-as-new).
- CI workflows (`ci`, `auto-assign-author`, `security-audit`) and tag-driven
  release workflow producing a Chrome Web Store-ready zip artifact.
