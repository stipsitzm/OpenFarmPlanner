# Changelog

## 0.9.1 - 2026-04-16

### Added

- New `leftColumnWidth` prop on `GanttChart` to configure left-column sizing.
- Long-label demo control for left-column width.

### Changed

- Left column width can now be fixed via prop while remaining backward compatible with the previous default width (`160px`).
- Left-column labels keep natural multi-line wrapping with long-word breaking and preserve full text via tooltip titles.
- Row-height estimation now uses the configured left-column width so task rows and timeline bars stay aligned.

## 0.9.0 - 2026-04-13

### Added

- Support multi-line wrapping for long left-column labels.
- Example app section "Long label demo" with long-label rows to visualize wrapping and bar alignment.

### Changed

- Left column labels no longer truncate with ellipsis and now wrap naturally.
- Row height now accounts for wrapped label content while keeping timeline bars vertically aligned.
- No API changes; this is a visual behavior improvement.
