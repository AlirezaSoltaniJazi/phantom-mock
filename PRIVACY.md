# Phantom Mock — Privacy Policy

_Last updated: 2026-05-16_

## Summary

Phantom Mock does not collect, transmit, or sell any personal data. All rules
and configuration are stored locally inside your browser via
`chrome.storage.local` and never leave your device.

## Data we handle

| Data                                                    | Where it lives                                                                       | Sent off-device? |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------- |
| Mock rules and groups you create                        | `chrome.storage.local` (your browser profile)                                        | No               |
| Per-rule "hit" entries (URL, method, status, timestamp) | In-memory ring buffer inside the extension, cleared when the service worker restarts | No               |
| URLs and HTTP methods of pages you browse               | Read transiently to evaluate match rules; not stored                                 | No               |
| Telemetry / analytics                                   | We do not collect any                                                                | —                |

## Permissions and why we need them

| Permission                                               | Justification                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Implement header overwrite rules at the network layer.                                                                                                                          |
| `storage`                                                | Persist your rules and groups between browser sessions.                                                                                                                         |
| `scripting`                                              | Inject the page-world mocking script that patches `fetch` and `XMLHttpRequest` so we can mock response bodies for REST APIs.                                                    |
| `<all_urls>` host permission                             | Required to inject the mocking script on whichever site you choose to mock. Phantom Mock does not phone home; the host permission is used purely to apply the rules you define. |

## Third parties

Phantom Mock has no third-party SDKs, no analytics, and no advertising
integrations. The extension makes no outbound network requests of its own.

## Contact

Open an issue at <https://github.com/AlirezaSoltaniJazi/phantom-mock/issues>.
