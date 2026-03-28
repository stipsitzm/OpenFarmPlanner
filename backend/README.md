# OpenFarmPlanner Backend

Django REST backend for OpenFarmPlanner.

This README covers backend-specific development details. For the full project overview, start at the root [`README.md`](../README.md).

## Stack

- Python 3.12+
- Django 5.2
- Django REST Framework
- PDM

## Setup

```bash
cd backend
cp .env.example .env
pdm install
pdm run migrate
pdm run runserver
```

API base path: `http://localhost:8000/openfarmplanner/api/`
Admin path: `http://localhost:8000/openfarmplanner/admin/`

## Useful Commands

```bash
pdm run makemigrations
pdm run migrate
pdm run test
pdm run createsuperuser
```

## Authentication and API Notes

- Auth endpoints: `/openfarmplanner/api/auth/*`
- API endpoints: `/openfarmplanner/api/*`
- Session authentication with CSRF protection is enabled.
- Most API endpoints require authentication by default.

## Environment Notes

- Environment variables are loaded from `backend/.env`.
- SQLite is used by default in development.
- PostgreSQL can be enabled via `DB_ENGINE` and related DB settings.
- Email behavior is environment-driven (console backend in development by default).

See `.env.example` and `config/settings.py` for all available backend configuration options.
