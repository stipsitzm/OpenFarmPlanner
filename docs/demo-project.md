# Demo Project Template

OpenFarmPlanner defines its reusable demo project data in
`backend/farm/services/demo_project.py`.

The service has two entry points:

- `create_personal_demo_project(user=...)` creates one normal, editable
  project for the authenticated user and is used by first-project onboarding.
- `create_or_reset_demo_project(...)` recreates the local screenshot/demo
  fixture used by the management command and landing-page screenshot workflow.

The template currently creates the `Solawi Sonnenacker 2026` project with two
locations, four fields, twelve beds, three suppliers, eight vegetable cultures,
seed package data, and twelve planting plans for the 2026 season. All created
records are project-scoped and owned by the receiving user through a regular
admin `ProjectMembership`.

To adjust the template, update the specs in `demo_project.py` and extend the
focused backend tests in `backend/farm/tests/test_demo_project.py`. The project
API behavior is covered in `backend/farm/tests/test_projects_api.py`; the
frontend onboarding choice is covered in
`frontend/src/__tests__/ProjectSelectionPage.test.tsx` and
`frontend/e2e/onboarding-demo-project.spec.ts`.

Local checks:

```bash
cd backend
pdm run test farm/tests/test_demo_project.py farm/tests/test_projects_api.py

cd ../frontend
npx vitest run src/__tests__/ProjectSelectionPage.test.tsx
npx playwright test e2e/onboarding-demo-project.spec.ts
```

For the standalone local demo user/project used outside onboarding:

```bash
cd backend
pdm run python manage.py seed_demo_project
```
