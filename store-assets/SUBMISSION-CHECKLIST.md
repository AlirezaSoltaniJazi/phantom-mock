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
- [ ] Store icon (128×128) under `store-assets/icons/`.
- [ ] Optional: small promo tile (440×280), marquee (1400×560).

## Permissions justification

For each permission, paste this into the dashboard "Permission justifications":

- `declarativeNetRequest` — required to implement user-defined header overrides at the network layer.
- `declarativeNetRequestFeedback` — required for debugging which DNR rules matched during development; needed for the "hit log" surface in the DevTools panel.
- `storage` — required to persist the user's rules and groups between sessions.
- `scripting` — required to inject the page-world script that mocks `fetch` and `XMLHttpRequest` response bodies.
- `<all_urls>` host permission — required because users may choose to mock requests from any site they visit; we only inject when a matching rule is present, and we never exfiltrate page content.

## Single-purpose statement

"Phantom Mock provides developers a way to mock and override REST API
requests and headers from the browser for testing and debugging."

## Privacy

- [ ] `PRIVACY.md` is committed and published at the URL declared in `store-assets/listing.md`.
- [ ] "Data usage" disclosures in dashboard match the policy (no personal data collected).

## Final

- [ ] `CHANGELOG.md` has an entry for this version.
- [ ] GitHub Release for the tag is published and links to the zip.
- [ ] CWS reviewers can reproduce screenshots with the rules in `store-assets/screenshots/sample-rules.json` (optional).
