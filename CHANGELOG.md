# Changelog

All notable changes to Phantom Mock are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Behind-the-scenes improvements to how new versions are released, so
  updates reach users more smoothly and reliably.

## [0.7.0] - 2026-06-14

### Added

- Drag to reorder groups in the Groups tab.
- Groups can now be set to activate only on specific pages.
- A "Reset all data" option in Settings for a clean slate.

### Changed

- Toast notifications now show which group triggered them.
- The tab bar wraps instead of overflowing on narrow panels.
- Exported file names now include the time, so exporting more than once a
  day no longer overwrites the previous file.
- Routine dependency updates.

### Fixed

- Fixed a console error that could appear after reloading or updating the
  extension.

### Security

- Updated a build tool to fix a known security vulnerability (no impact on
  the published extension itself).

## [0.6.0] - 2026-06-07

### Added

- New "Template" URL matching — one rule can now cover a whole family of
  dynamic URLs (like ones containing an ID), and mock responses can include
  auto-generated random values.
- New Groups tab for managing rule groups at a glance.
- The popup and Settings now show the extension's version number.
- Captured request/response bodies are shown in a readable, collapsible
  format.

### Changed

- Releases now include both the Chrome Web Store package and a local
  install package.
- The popup shows a helpful message when no groups are visible in it.

### Fixed

- Header rules now apply to every type of request, fixing cases where a
  missing header could cause unexpected behavior on some sites.
- Fixed an issue with automatic PR author assignment (contributor-facing).

## [0.5.2] - 2026-05-30

### Fixed

- Fixed an issue where importing settings could be incorrectly blocked
  with an error.

## [0.5.1] - 2026-05-30

### Changed

- Replaced example placeholder text in the editor and docs with more
  generic examples.

## [0.5.0] - 2026-05-30

### Added

- New Cookie Profiles — save cookie values for the current page and switch
  between them with one click, including secure cookies that JavaScript
  normally can't access.
- Cookie profiles are now included in Export/Import.
- Optional prefix/suffix wrapping for cookie values.

### Changed

- The extension now asks for permission to read/write cookies.

### Fixed

- Fixed cookie handling for pages with non-root paths.

### Security

- Added protections so one browser tab can't read or change another tab's
  cookies through the extension.
- Restricted a sensitive settings-import action to trusted extension
  screens only.

## [0.4.0] - 2026-05-30

### Added

- New Storage Profiles — save localStorage values for the current page and
  switch between them with one click.
- Storage profiles are now included in Export/Import.
- Optional prefix/suffix wrapping for storage values.

### Fixed

- Fixed a bug where certain updates could wipe out existing rules.
- Friendlier message when using Storage features outside of DevTools.

## [0.3.0] - 2026-05-29

### Added

- Local builds can now be installed side-by-side with the Chrome Web
  Store version without conflicts.
- New Debug tab to help troubleshoot header rules.
- Live view of header rules firing in real time.
- A warning in the rule editor when a header rule might not apply after a
  redirect.

### Fixed

- Fixed a bug where some header rules could silently fail to apply.
- Rule sync failures are now logged instead of failing silently.

## [0.2.0] - 2026-05-23

### Added

- Multi-select and bulk delete for rules.
- Collapse/expand groups in the Rules tab and popup.

### Fixed

- Fixed an extension loading error.
- Header rules now apply to page loads too, not just background requests.
- Cleaned up invalid rule data left behind by saving or importing.
- Better handling of conflicting rules/groups when importing.

### Changed

- Master switch and other toggles redesigned as sliding switches.
- Updated underlying libraries.

## [0.1.3] - 2026-05-18

### Changed

- Removed an unused permission to comply with Chrome Web Store policy.

## [0.1.1] - 2026-05-17

### Added

- First full release: mock API responses, capture and replay network
  traffic, manage rules and groups, in-page notifications, and a full
  DevTools panel (Rules, Editor, Hit Log, Capture, Settings).
- Browser toolbar popup with a master on/off switch.
- Debug helpers for advanced users.

### Submission notes

- First Chrome Web Store submission was rejected over an unused
  permission; fixed in 0.1.3.

## [0.1.0] - 2026-05-17

### Added

- Initial project setup.

[Unreleased]: https://github.com/AlirezaSoltaniJazi/phantom-mock/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/AlirezaSoltaniJazi/phantom-mock/releases/tag/v0.7.0
