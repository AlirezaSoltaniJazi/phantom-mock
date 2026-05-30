# Chrome Web Store listing

## Name

Phantom Mock

## Category

Developer Tools

## Short description (max 132 chars)

Mock REST API responses, override headers, switch localStorage values and
cookies on the inspected page — right from DevTools.

## Long description

Phantom Mock is a developer-focused Chrome extension that lets you intercept
REST API traffic, override headers, and flip web-storage values right
inside the browser — without spinning up a separate mock server.

**Mock response bodies.** Match a URL by exact value, substring, or regex,
optionally narrowed to a specific HTTP method, and reply with a status code,
custom delay, content-type, and response body of your choice.

**Override headers.** Add, set, append, or remove arbitrary request or
response headers using the same URL matching, backed by Chrome's native
`declarativeNetRequest` so it shows up in the Network tab like a real
header.

**Switch localStorage values (Storage tab).** Define a profile per key with a
list of candidate values (e.g. `en_GB` / `de_DE` for a locale key) and flip
between them with one click. Optional value-wrapping (prefix / suffix) so
JSON-quoted values like `"en_GB"` work out of the box. Optional auto-reload
of the inspected page after each switch.

**Switch cookies (Cookies tab).** Same chip-selector UX for cookies,
including `httpOnly` cookies that `document.cookie` can't touch. Defines a
profile per cookie name + optional path, then flips with one click. Common
case: `app_locale` between `en` / `de` / `fr` without touching the
Application panel.

**Organize and toggle.** Group rules, flip individual rules or whole groups
on and off, or kill everything with the master switch in the popup.

**Audit overridden traffic.** Each mocked request can be logged to the
Phantom Mock DevTools panel so you can see exactly what was overridden,
when, and by which rule. A separate Debug tab shows the live state of
`chrome.declarativeNetRequest`: registered dynamic rules, the last sync
error, a "Test against URL" form, and a live tail of every header-rule
match.

**Import / export.** Share rule sets, storage profiles, and cookie profiles
with your team via a single JSON file, with merge strategies for replacing,
merging by id, or appending as new — plus per-item conflict resolution.

Phantom Mock works fully offline. No accounts, no telemetry, no servers —
everything lives in your browser's local storage.

## Tags / keywords

mock, rest, api, http, fetch, xhr, headers, devtools, testing, proxy,
cookies, localStorage, sessionStorage, locale, feature-flags, tenant

## Support URL

https://github.com/AlirezaSoltaniJazi/phantom-mock/issues

## Privacy policy URL

https://github.com/AlirezaSoltaniJazi/phantom-mock/blob/main/PRIVACY.md
