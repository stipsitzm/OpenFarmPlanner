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

API base path: `http://localhost:8000/api/`
Admin path: `http://localhost:8000/admin/`

## Useful Commands

```bash
pdm run makemigrations
pdm run migrate
pdm run test
pdm run createsuperuser
pdm run compilemessages
```

### Making Model Changes
1. Edit models in `farm/models.py`
2. Create migrations:
   ```bash
   pdm run makemigrations
   ```
3. Apply migrations:
   ```bash
   pdm run migrate
   ```

### Accessing Admin Interface
1. Create a superuser (if not already done):
   ```bash
   pdm run createsuperuser
   ```
2. Start the server:
   ```bash
   pdm run runserver
   ```
3. Visit `http://localhost:8000/admin/`

## Environment Variables

For production, configure these environment variables:
- `SECRET_KEY` - Django secret key
- `DEBUG` - Set to `False` in production
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts
- `SECURE_SSL_REDIRECT` - Enable HTTPS redirects only if the proxy chain is configured correctly
- `SECURE_PROXY_SSL_HEADER` - Proxy header tuple, for example `HTTP_X_FORWARDED_PROTO,https`
- `USE_X_FORWARDED_HOST` - Trust the forwarded host from the reverse proxy
- `SESSION_COOKIE_SECURE` - Secure session cookies in HTTPS deployments
- `CSRF_COOKIE_SECURE` - Secure CSRF cookies in HTTPS deployments
- `SECURE_HSTS_SECONDS` - HSTS max-age for production
- `EMAIL_HOST_PASSWORD` - SMTP password for `noreply@zwiebelzopf.at`
- `PUBLIC_FRONTEND_URL` - Public frontend base URL used in activation, password reset, and invitation links
- `FRONTEND_URL` - Optional local/development fallback for frontend links
- `URL_PREFIX` - Optional backend URL prefix (default: root). Example: `openfarmplanner` for legacy prefixed routing.

### SMTP configuration for Uberspace (production)

Use these settings in your environment:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=mail.uberspace.de
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@zwiebelzopf.at
EMAIL_HOST_PASSWORD=<your-secret-password>
DEFAULT_FROM_EMAIL=OpenFarmPlanner <noreply@zwiebelzopf.at>
PUBLIC_FRONTEND_URL=https://your-frontend-domain.tld
```

For local development you can keep email output in the terminal:

```env
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

### Translation compilation

Compiled Django translation binaries (`*.mo`) are generated artifacts and are not committed.
Compile them during build/deploy (or locally after editing `.po` files):

```bash
pdm run compilemessages
```

The `compilemessages` script uses `config.settings_test` so it can run without production-only secrets.

### Authentication endpoints

Auth endpoints are available under `/api/auth/`:

- `GET csrf/`
- `POST register/`
- `POST activate/`
- `POST login/`
- `POST logout/`
- `GET me/`
- `POST resend-activation/`
- `POST password-reset/`
- `POST password-reset-confirm/`

### DNS recommendations for deliverability
## Authentication and API Notes

- Auth endpoints: `/api/auth/*`
- API endpoints: `/api/*`
- Legacy prefixed auth/API endpoints: `/openfarmplanner/api/*`
- Agent login consume endpoint: `/agent-login/<token>/` and legacy `/openfarmplanner/agent-login/<token>/`
- Session authentication with CSRF protection is enabled.
- Most API endpoints require authentication by default.

## Environment Notes

- Environment variables are loaded from `backend/.env`.
- SQLite is used by default in development.
- PostgreSQL can be enabled via `DB_ENGINE` and related DB settings.
- Email behavior is environment-driven (console backend in development by default).

See `.env.example` and `config/settings.py` for all available backend configuration options.
