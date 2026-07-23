# QA Coverage — 2026-07-23

Targeted public culture publishing-flow audit based on Git commit `9cf48784`
on branch `fix/simplify-publishing-wizard`.

## Audited areas

| Area | Viewports | Result |
|---|---|---|
| Culture publishing dialog | 1440x900, 390x844 | simplified dialog stays compact; summary/checklist/license are hidden initially |
| Official crop species selection | 1440x900 | seeded species list is available; `Tomate` can be selected |
| License reveal timing | 1440x900 | license checkbox appears only after publish readiness checks pass |
| Successful publication | 1440x900 | publication completes and shows the success snackbar |
| Duplicate check | 1440x900 | same species + variety blocks publication with an inline duplicate warning |
| Post-publish culture action menu | 1440x900 | stale state found during audit; fixed by refreshing the culture list after successful publish |
| Mobile publishing dialog | 390x844 | dialog remains centered and compact at about 326x445 px |

## Findings

- During the initial audit, the selected project culture was not refreshed
  after a successful publication, so the action menu stayed on the
  pre-publication actions until reload. The follow-up implementation refreshes
  the culture list after successful publishing so the update/withdraw actions
  become available immediately.

## Verification

- Temporary Playwright QA spec using the repository E2E fixture endpoint.
- Follow-up temporary Playwright spec verified that the menu refreshes
  immediately after publishing, without a page reload.
- Frontend/backend served through the standard Playwright web-server setup.
- No temporary QA spec or generated Playwright artifacts are tracked.
