# Chrome Web Store submission checklist

Walk through this list before clicking "Submit for review".

## Build & artifact

- [ ] `npm run release` succeeded locally with no failures.
- [ ] `release/phantom-mock-<version>.zip` exists and unzips cleanly.
- [ ] `manifest.json` `version` matches the tag and the artifact name.
- [ ] Extension loads as unpacked from `dist/` without console errors.

## Store listing copy

- [ ] `store-assets/listing.md` short description ≤ 132 chars.
- [ ] Long description renders well in the dashboard preview.
- [ ] Category set to **Developer Tools**.
- [ ] Primary language set.
- [ ] Support email is monitored.

## Visual assets (all PNG, no alpha)

- [ ] At least 1 screenshot (1280×800 or 640×400) under `store-assets/screenshots/`.
- [ ] For v0.5.0 specifically: add screenshots for the new **Storage** and **Cookies** tabs so the listing visibly matches the new permission warning. CWS reviewers compare the screenshots against the permissions you request — silent permission additions without UI evidence get rejected more often.
- [ ] Re-export any existing `.jpg` screenshots to `.png` (CWS prefers PNG, and `.jpg` with quality loss can blur small UI text on the listing).
- [ ] Store icon (128×128) under `store-assets/icons/`.
- [ ] Optional: small promo tile (440×280), marquee (1400×560).

## Permissions justification

For each permission, paste this into the dashboard "Permission justifications":

- `declarativeNetRequest` — required to implement user-defined header overrides at the network layer.
- `declarativeNetRequestFeedback` — required for debugging which DNR rules matched during development; needed for the "hit log" and "Debug" tabs in the DevTools panel.
- `storage` — required to persist the user's rules, groups, storage profiles, and cookie profiles between sessions via `chrome.storage.local`.
- `cookies` — required by the Cookies tab so the developer can read and overwrite a single cookie on the inspected tab (e.g. switch `django_language` between `en` / `de` while debugging). Used only in response to an explicit chip click in the panel — cookies are never read in the background and never leave the browser.
- `<all_urls>` host permission — required because users may choose to mock requests, switch localStorage values, or overwrite cookies on any site they visit; the extension only acts on the tab the developer has open in DevTools and never exfiltrates page content.

## Single-purpose statement

"Phantom Mock provides developers a way to mock REST API responses, override
request/response headers, and switch localStorage values and cookies on the
inspected page — all from the browser DevTools panel for testing and
debugging."

## Privacy

- [ ] `PRIVACY.md` is committed and published at the URL declared in `store-assets/listing.md`.
- [ ] "Data usage" disclosures in dashboard match the policy (no personal data collected).

## Final

- [ ] `CHANGELOG.md` has an entry for this version.
- [ ] GitHub Release for the tag is published and links to the zip.
- [ ] CWS reviewers can reproduce screenshots with the rules in `store-assets/screenshots/sample-rules.json` (optional).
