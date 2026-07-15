# Crop Library / Farm Planning Architecture

Date: 2026-07-03
Scope: `backend/`, `frontend/src/`

Goal: prepare and evolve the architecture for a public Crop Library
(`/crops`) without splitting the repository unnecessarily. The library is
now treated as a long-lived, community-built knowledge base for crop data,
not as a personal publishing shelf that users can normally withdraw from
at will.

## 0. Product and legal model

The public Crop Library follows an open-data model:

- Published crop data becomes part of a shared knowledge base intended to
  persist beyond the contributing user's project or account.
- Normal user-driven deletion/unpublishing is not part of the product
  model. Removal should be reserved for exceptional cases such as unlawful
  content, personal data in a published record, spam, obvious abuse, or a
  moderation decision.
- Public crop data is intended to be reusable through the app, future
  public APIs, future downloads/exports, and external open-source or
  commercial projects.
- Contributions are licensed under Creative Commons
  Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). The license is
  suitable here because it allows copying, adaptation, redistribution, and
  commercial use while preserving attribution and share-alike conditions.
- A user's first publication must be a conscious act: the UI explains the
  persistence and license terms, and the backend records acceptance as
  `DocumentConsent.DOCUMENT_PUBLIC_LIBRARY`. This contribution consent is
  separate from the global Terms consent so it can be versioned and audited
  without blocking users who never publish.

Future moderation should prefer non-destructive state transitions
(`hidden`, `removed`, `needs_review`) over hard deletes, so attribution,
license evidence, import lineage, and revision history remain auditable
where legally permissible.

## 1. The current situation (before this pass)

The domain split the long-term vision asks for — a public Crop Library
vs. project-scoped Farm Planning — **already existed at the data model
level**, just not as a formalized service/app boundary:

- **`Culture`** (`backend/farm/models/cultures.py`) is project-owned: it has a
  required `project` FK. Every project has its own private copy of every
  variety it grows, with growing parameters, supplier links, seed
  packages, and revision history (`CultureRevision`). This is Farm
  Planning data.
- **`PublicCulture`** (same file) is the shared library: no `project` FK
  of its own, only nullable *provenance* links (`source_project_culture`,
  `source_project`) recording where a published entry came from. This is
  Crop Library data.
- A bridge, `backend/farm/services/public_cultures.py`, copies data both
  ways: `publish_culture_to_public_library()` (a project's `Culture` →
  the library) and `import_public_culture_into_project()` (a library
  entry → a new project-owned `Culture`).
- `PublicCultureViewSet` (`/api/public-cultures/`) was already read-only
  and required only authentication — no project scoping at all, since a
  published crop isn't owned by any one project.
- The frontend already has an equivalent precedent for "routes outside
  the authenticated app": `frontend/src/pages/public/` (landing page,
  imprint, privacy policy) and `frontend/src/pages/auth/` (login,
  registration, ...) both render outside `/app`, gated only by
  `<ProtectedRoute />` wrapping the `/app` branch specifically. `/app` is
  already the prefix for the entire authenticated Farm Planning app; `/`
  is already the public root.

So the real work here was formalizing an existing, correct data split
into an explicit service/app boundary — not inventing the split from
scratch.

## 2. What this pass added

### Backend — a new `crops` Django app

`backend/crops/` is a real Django app (`INSTALLED_APPS`), but it
**defines no models**. `PublicCulture` stays in `farm.models` — moving a
model to a different app changes its migration state and (without
careful `SeparateDatabaseAndState` migrations) its `app_label`-derived
`db_table`. That's a real risk to existing data, and the task explicitly
asks to avoid exactly this kind of unnecessary risk. `crops/models.py`
documents this and names `PublicCulture` as the thing to move first in a
future extraction.

```
backend/crops/
  apps.py          CropsConfig
  models.py        (empty — see above)
  services.py      list_published_crops(), get_published_crop(),
                    find_exact_crop_match() — reads farm.models.PublicCulture,
                    nothing else
  serializers.py   CropSerializer (read-only; deliberately excludes
                    source_project/source_project_culture — see §3)
  views.py         CropViewSet (ReadOnlyModelViewSet, IsAuthenticated)
  urls.py          router → included at /api/crops/
  tests/
```

This is **additive**: `/api/public-cultures/` keeps working exactly as
before (still defined in `farm/cultures/views.py`/`farm/urls.py`, untouched) —
the current frontend keeps using it. `/api/crops/` and `/api/crops/<id>/`
are new, parallel endpoints with the same `IsAuthenticated` requirement
as everything else — **not actually public yet**. Making them public
later is a one-line permission-class change, not a rewrite.

`config/settings.py` (`INSTALLED_APPS`) and `config/urls.py` (both the
plain and legacy-prefixed mounts, matching how `farm.urls` is already
double-mounted) were updated to register the new app.

### Frontend — `frontend/src/crops/`

```
frontend/src/crops/
  api/cropsApi.ts        new client for /api/crops (list/get/match) —
                         NOT wired into any page yet
  components/
    PublicCultureLibraryDialog.tsx   moved from src/cultures/ (see §3)
  pages/                 empty (README explains what goes here later)
  hooks/                 empty (README explains what goes here later)
  index.ts               barrel (mirrors src/cultures/index.ts's convention
                         of exporting only the public-facing pieces)
```

`cropsApi.ts` exists so future code has somewhere to import from, but
`Cultures.tsx` / `PublicCultureLibraryDialog` still call the existing
`publicCultureAPI` in `api/api.ts` — switching the data source is a
separate, deliberate future step (see §5), not bundled into this
architecture pass.

`App.tsx`'s router got one comment, no new route: a reserved spot for a
future `/crops` branch as a sibling of `/app` (not nested under
`<ProtectedRoute />`), pointing at `frontend/src/crops/pages/`.

## 3. The domain rule, and where it bites

> "Die Crop Library darf keinerlei Wissen über Projekte besitzen. Die
> Projektlogik darf lediglich die Crop Library verwenden."

Applied concretely:

- `crops/services.py`, `crops/serializers.py`, `crops/views.py` import
  only `farm.models.PublicCulture` and `farm.utils.normalize_text` — never
  farm's view/serializer packages, `Project`, or `Culture`. This is the
  one dependency direction that matters: if `crops` ever imported from
  farm's serializers, the arrow would point the wrong way (crop library
  depending on farm planning).
- `crops/serializers.py`'s `CropSerializer` is **not** a re-export or
  subclass of `farm.cultures.serializers.PublicCultureSerializer`, even though
  they're currently near-identical — importing it would create exactly
  that backwards dependency. It's a small, deliberate duplication.
- `CropSerializer` also deliberately **excludes**
  `source_project_culture`/`source_project` (present in the legacy
  `PublicCultureSerializer`) — those are project-provenance fields, and
  exposing them on the crop-library-facing surface would leak Farm
  Planning knowledge outward.
- The publish/import bridge itself (`farm/services/public_cultures.py`)
  is **not** moved into `crops`. It inherently needs both `Culture` and
  `Project` — it's a bridge, not a pure citizen of either domain. It's
  called "farm's dependency on the crop library" already (`farm/cultures/views.py`
  imports it), which is the correct direction; deciding whether it should
  someday become a real network call (once crops is an actual separate
  service) is future work, documented in §5, not solved now.
- `frontend/src/pages/usePublicCultureLibrary.ts` — the hook driving
  publish/import from the Cultures page — stays in `pages/` for the same
  reason: it's the Farm-Planning-side integration point, not
  crop-library-only logic (it reads/writes a project's `Culture` and
  needs a `selectedCulture`/`onImportSuccess` callback tied to that
  page's state).
- `frontend/src/cultures/CultureDetail.tsx` also stays where it is: it's
  reusable, prop-driven code, but the *data* it displays (a project's own
  cultures) is Farm Planning data, not the library. Only
  `PublicCultureLibraryDialog.tsx` — which genuinely only ever renders
  `PublicCulture[]` — moved to `crops/components/`.

## 4. Naming

New code in `crops/` uses "Crop" (`CropSerializer`, `CropViewSet`,
`cropsApi`, `Crop` type alias) per the task's naming rule. Existing
backend fields/models/endpoints (`Culture`, `PublicCulture`,
`/api/cultures/`, `/api/public-cultures/`) were **not** renamed — the
task explicitly allows deferring "umfangreiche Umbenennungen" rather than
risking them, and renaming a Django model/db column/serializer field
touches migrations, the DRF response shape, and every frontend call site
for no functional benefit right now. German UI text (`"Kultur"`,
`"Kulturbibliothek"`) is untouched, as required.

## 5. Deliberately NOT done (and why)

| Not done | Why | Future path |
|---|---|---|
| Moving `PublicCulture` (or `Culture`) into `crops.models` | Changes migration state / `app_label`-derived `db_table`; real risk to existing data for zero current benefit | A dedicated migration using `SeparateDatabaseAndState` to move the model's Django state into `crops` while keeping (or explicitly renaming, in one controlled step) the actual table |
| Removing/renaming `/api/public-cultures/` | Would break the current frontend (`publicCultureAPI`) — a functional change the task forbids | Once `Cultures.tsx`/`PublicCultureLibraryDialog` are switched to `cropsApi`/`/api/crops`, deprecate and remove the legacy path |
| Switching the frontend to actually call `/api/crops` | Not required to "prepare" the architecture, and swapping a working data source is exactly the kind of change to do deliberately and separately, with its own testing pass | Point `Cultures.tsx` at `cropsApi` instead of `publicCultureAPI`, delete the old client, delete `/api/public-cultures/` |
| A real `/crops` route/page | Explicitly "noch NICHT veröffentlichen" | Add route components under `frontend/src/crops/pages/`, wire the reserved router branch in `App.tsx`, flip `CropViewSet.permission_classes` |
| Splitting `i18n/locales/*/cultures.json` into a `crops` namespace | Namespace holds both library- and farm-planning-flavored strings today; splitting now is pure churn for zero user-visible benefit | Split when `crops/pages/` gets real UI text to hold |
| Moving `Culture`/`CultureViewSet`/`CultureSupplierData`/`SeedPackage` into `crops` | These are genuinely Farm Planning (project-owned, or only meaningful attached to a project-owned `Culture`) — moving them would be the large, risky refactor the task asks to avoid | Not planned; these belong in Farm Planning long-term too |
| Fixing `PublicCultureLibraryDialog.tsx`'s cross-import of `stripCitationMarkers` from `components/data-grid/markdown`, or its two pre-existing `react-hooks/set-state-in-effect` lint errors | Both pre-date this move (confirmed by lint-checking the file at its old path before moving it) — fixing them isn't in scope for an architecture-only pass | A future cleanup could move the markdown helper to a shared, domain-neutral location |

## 6. Verifying nothing changed for users

- Every existing API path (`/api/cultures/...`, `/api/public-cultures/...`)
  is untouched — same views, same serializers, same URLs.
- The frontend still imports `PublicCultureLibraryDialog` and calls
  `publicCultureAPI` exactly as before; only its file location and import
  path changed.
- No new frontend route is reachable; the `/crops` reservation is a
  comment.
- Backend: 409 existing tests pass (1 pre-existing, unrelated failure —
  a German-umlaut encoding mismatch in
  `accounts/tests/test_auth_api.py`, confirmed present on `main` before
  this branch too), plus 12 new tests for the `crops` app.
- Frontend: all 956 existing tests pass, plus 3 new tests for `cropsApi`.
