# Form Layout

OpenFarmPlanner uses responsive field-width roles from
`frontend/src/components/forms/formLayout.ts`. Form fields are full width on
small screens and receive a stable maximum width from the `sm` breakpoint.
This keeps desktop forms compact without introducing separate mobile forms.

## Width roles

| Role | Typical content | Desktop maximum |
|---|---|---:|
| `compactFieldSx` | numbers, dates, versions, priorities | 180 px |
| `smallFieldSx` | short selects, status, units, methods | 224 px |
| `mediumFieldSx` | families, suppliers, coordinates | 300 px |
| `wideFieldSx` | names, email addresses, URLs | 400 px |
| `fullWidthFieldSx` | descriptions, notes, comments | full row |

Use `formRowSx` to place related compact fields beside each other. It wraps
automatically and aligns fields at the top so validation and helper text do
not disturb neighboring controls. `singleColumnFormSx` caps authentication
and similar identity forms at the same width as a wide field.

## Exceptions

DataGrid cell editors must fill their cell and therefore do not use these
roles. A field may also remain full width inside an already narrow popover or
small dialog, and search fields may grow when the remaining horizontal space
is intentionally assigned to search.
