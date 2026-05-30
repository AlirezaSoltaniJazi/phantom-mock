# Phantom Mock — Privacy Policy

_Last updated: 2026-05-30_

## Summary

Phantom Mock does not collect, transmit, or sell any personal data. All rules
and configuration are stored locally inside your browser via
`chrome.storage.local` and never leave your device.

## Data we handle

| Data                                                    | Where it lives                                                                                                                                                                                                                     | Sent off-device? |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Mock rules and groups you create                        | `chrome.storage.local` (your browser profile)                                                                                                                                                                                      | No               |
| Storage profiles and cookie profiles you create         | `chrome.storage.local` (your browser profile)                                                                                                                                                                                      | No               |
| Per-rule "hit" entries (URL, method, status, timestamp) | In-memory ring buffer inside the extension, cleared when the service worker restarts. **Note**: full URLs are stored, so query-string secrets (e.g. `?token=…`) appear here until you click **Clear** in the Hit Log or Debug tab. | No               |
| URLs and HTTP methods of pages you browse               | Read transiently to evaluate match rules; not stored                                                                                                                                                                               | No               |
| Inspected page localStorage values                      | Read/written only on the tab you have open in DevTools, in response to your click                                                                                                                                                  | No               |
| Inspected page cookies (incl. `httpOnly`)               | Read/written only on the tab you have open in DevTools, in response to your click. We do not enumerate cookies you haven't explicitly added a profile for.                                                                         | No               |
| Telemetry / analytics                                   | We do not collect any                                                                                                                                                                                                              | —                |

## Permissions and why we need them

| Permission                                               | Justification                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Implement header overwrite rules at the network layer.                                                                                                                          |
| `storage`                                                | Persist your rules and groups between browser sessions.                                                                                                                         |
| `cookies`                                                | Read and write cookies on the inspected tab from the **Cookies** tab. Used only in response to your click on a candidate value; cookies are never read in the background.       |
| `<all_urls>` host permission                             | Required to inject the mocking script on whichever site you choose to mock. Phantom Mock does not phone home; the host permission is used purely to apply the rules you define. |

## Third parties

Phantom Mock has no third-party SDKs, no analytics, and no advertising
integrations. The extension makes no outbound network requests of its own.

## Contact

Open an issue at <https://github.com/AlirezaSoltaniJazi/phantom-mock/issues>.
