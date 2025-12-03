# CSA Farm Planner - Backend

Django REST API backend for the CSA Farm Planner application.

## Technology Stack

- **Python 3.12+**: Programming language
- **Django 5.2.9**: Web framework
- **Django REST Framework 3.16**: API framework
- **django-cors-headers 4.9**: CORS support
- **PDM**: Modern Python package manager

## Prerequisites

- Python 3.12 or higher
- PDM (Python Dependency Manager)

## Installing PDM

If you don't have PDM installed:

```bash
pip install --user pdm
```

Or using pipx (recommended):

```bash
pipx install pdm
```

## Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies using PDM:
```bash
pdm install
```

This will automatically:
- Create a virtual environment in `.venv/`
- Install all dependencies from `pyproject.toml`
- Set up the project for development

3. Run database migrations:
```bash
pdm run migrate
```

4. (Optional) Create a superuser for admin access:
```bash
pdm run createsuperuser
```

5. Start the development server:
```bash
pdm run runserver
```

The API will be available at `http://localhost:8000/api/`

## PDM Commands

PDM provides convenient scripts defined in `pyproject.toml`:

### Development Server
```bash
pdm run runserver        # Start Django development server
```

### Database Management
```bash
pdm run migrate          # Apply database migrations
pdm run makemigrations   # Create new migrations
```

### Testing
```bash
pdm run test             # Run all tests
```

### Admin & Utilities
```bash
pdm run createsuperuser  # Create admin user
pdm run shell            # Django shell
pdm run collectstatic    # Collect static files
```

### Dependency Management
```bash
pdm add <package>        # Add a new dependency
pdm add -d <package>     # Add a development dependency
pdm update               # Update all dependencies
pdm list                 # List installed packages
pdm remove <package>     # Remove a dependency
```

## Project Structure

```
backend/
├── config/              # Django project settings
│   ├── settings.py      # Main settings
│   ├── urls.py          # URL configuration
│   └── wsgi.py          # WSGI configuration
├── farm/                # Main application
│   ├── models.py        # Database models
│   ├── serializers.py   # DRF serializers
│   ├── views.py         # API views
│   ├── admin.py         # Admin configuration
│   ├── urls.py          # App URL routing
│   └── tests.py         # Tests
├── manage.py            # Django management script
├── pyproject.toml       # Project metadata and dependencies
└── .venv/               # Virtual environment (auto-generated)
```

## API Endpoints

All endpoints are available under `/api/`:

- `/api/locations/` - Location management
- `/api/fields/` - Field management
- `/api/beds/` - Bed management
- `/api/cultures/` - Culture (crop) management
- `/api/planting-plans/` - Planting plan management
- `/api/tasks/` - Task management

Each endpoint supports:
- `GET` - List all items
- `POST` - Create new item
- `GET /<id>/` - Retrieve specific item
- `PUT /<id>/` - Update specific item
- `DELETE /<id>/` - Delete specific item

## Data Models

### Location
Physical location where farming occurs
- name, address, notes

### Field
A field within a location
- name, location (FK), area_sqm, notes

### Bed
A bed within a field
- name, field (FK), length_m, width_m, notes

### Culture
A crop or plant type
- name, variety, days_to_harvest, notes

### PlantingPlan
Plan for planting a specific culture in a bed
- culture (FK), bed (FK), planting_date, harvest_date (auto-calculated), quantity, notes

### Task
Farm management tasks
- title, description, planting_plan (FK, optional), due_date, status

## Development

### Running Tests
```bash
pdm run test
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
- `DATABASE_URL` - Database connection string (if using PostgreSQL)

## License

MIT
