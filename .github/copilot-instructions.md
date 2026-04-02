# Copilot Instructions

## UI Language and i18n Rules (Mandatory)

- All user-visible UI text **must** come from the i18n layer (`useTranslation`, namespace keys).
- Do **not** add hardcoded UI strings (especially English) in components, dialogs, tables, filters, tooltips, snackbars, or form helpers.
- The default UI language in this project is German. New keys must include a German translation.
- Never render raw enum values or backend/internal field names directly in UI (for example: `high`, `medium`, `low`, `direct_sowing`, `created_at`).
- Always map backend and enum values to user-friendly, localized labels before rendering.
- Backend/API error payloads must be converted to friendly localized messages for end users.
- Technical/raw text is allowed only in logs/debug output (`console.*`, monitoring), not in visible UI.
- New UI features must be i18n-complete from the first commit:
  - labels
  - placeholders
  - empty states
  - loading states
  - validation errors
  - table headers
  - button texts
  - filter labels/options
  - tooltips
  - dialog content
- Reuse existing translation namespaces and patterns; do not create parallel localization mechanisms.

## Review Checklist for Every UI Change

- Verify there are no newly introduced hardcoded user-visible strings.
- Verify no raw technical values are rendered directly.
- Verify all new/changed messages are translated and understandable for users.
- Verify fallback messages shown from API errors are localized and non-technical.
- Verify updated tests (if applicable) assert localized labels rather than internal codes.
