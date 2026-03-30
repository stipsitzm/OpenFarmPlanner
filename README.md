# OpenFarmPlanner

OpenFarmPlanner is a full-stack web application for planning and managing market-garden or CSA farm operations.
It combines a Django REST backend and a React frontend in one repository, with project-based workflows, planting planning, and operational farm data management.

> Deployment and infrastructure are maintained in a separate repository: **[OpenFarmPlanner-ops](https://github.com/stipsitzm/OpenFarmPlanner-ops)**.

## Main Features

- Farm structure management (locations, fields, beds)
- Culture management with agronomic details and history/restore support
- Planting plans, task planning, and Gantt/yield-oriented views
- Seed demand and supplier workflows
- Multi-project support with project switching and invitations
- Session-based authentication (registration, activation, login/logout, password reset, account deletion/restore)
- Notes and media attachments

## High-Level Architecture

- **Backend (`backend/`)**: Django + Django REST Framework API, authentication, business logic, data persistence, media handling.
- **Frontend (`frontend/`)**: React + TypeScript SPA (Vite), UI workflows, routing, i18n resources, and API integration.
- **Operations (`OpenFarmPlanner-ops`)**: deployment, runtime environment, and operational automation (separate repository).

## Repository Structure

```text
.
├── backend/                  # Django backend application
├── frontend/                 # React frontend application
│   └── e2e/                  # Playwright end-to-end tests
├── docs/                     # Additional design/technical notes
├── scripts/                  # Shared utility and quality scripts
├── CONTRIBUTING.md           # Commit and contribution conventions
└── README.md                 # Canonical repository entry point
```

## Tech Stack

**Backend**
- Python 3.12+
- Django 5.2
- Django REST Framework
- PDM for dependency and script management
- SQLite by default (PostgreSQL supported via env configuration)

**Frontend**
- React 19 + TypeScript
- Vite
- Material UI
- React Router
- Axios
- Vitest + Testing Library
- Playwright (E2E)

## Quick Start (Local Development)

### Prerequisites

- Python 3.12+
- [PDM](https://pdm-project.org/)
- Node.js 20+
- npm 10+

### 1) Backend setup

```bash
cd backend
cp .env.example .env
pdm install
pdm run migrate
pdm run runserver
```

Backend API base path: `http://localhost:8000/openfarmplanner/api/`

### 2) Frontend setup

In a new terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend dev server: `http://localhost:5173/openfarmplanner`

## Backend / Frontend Overview

- The frontend sends credentialed requests to `/openfarmplanner/api/` and includes CSRF headers for write operations.
- The backend enforces authenticated access for API endpoints by default and supports project scoping via `X-Project-Id`.
- Public flows (registration, activation, login, password reset, invitation acceptance) are exposed through dedicated auth/invitation endpoints.

## Authentication Overview

OpenFarmPlanner uses Django session authentication with CSRF protection:

- Register account
- Activate account by email link
- Login / logout
- Password reset request and confirmation
- Account deletion request with grace period and restoration flow

Authentication endpoints are available under:

- `/openfarmplanner/api/auth/*`

## Testing Overview

### Backend

```bash
cd backend
pdm run test
```

### Frontend unit/integration tests

```bash
cd frontend
npm run test
```

### Frontend end-to-end tests

```bash
cd frontend
npm run test:e2e
```

## Version Bumping

Project version is defined in `backend/config/version.py` as a semantic version (`MAJOR.MINOR.PATCH`).

Use the provided script via Make:

```bash
make bump-version TYPE=fix
```

Supported change types:

- `TYPE=feat` → bumps **minor** (`x.Y.z`) and resets patch to `0`
- `TYPE=fix` → bumps **patch** (`x.y.Z`)
- `TYPE=breaking` → bumps **major** (`X.y.z`) and resets minor/patch to `0`

The update is validated and applied safely:

- exactly one `VERSION = "..."` definition must exist,
- version format must be valid semver,
- file writes are done via atomic replace.

## Documentation Map

- `backend/README.md` – backend-specific development details
- `frontend/README.md` – frontend-specific development details
- `frontend/e2e/README.md` – E2E testing notes
- `CONTRIBUTING.md` – commit conventions and contribution expectations

## Deployment / Operations

Deployment and runtime operations are intentionally separated from this repository.
Use the ops repository for deployment guides, infrastructure configuration, and environment-specific operational steps:

- **https://github.com/stipsitzm/OpenFarmPlanner-ops**

## Contributing

Pull requests are welcome.

For larger changes, please open an issue first to align on scope and approach.
Keep contributions focused, incremental, and consistent with the existing project structure and style.

See `CONTRIBUTING.md` for commit format requirements.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
