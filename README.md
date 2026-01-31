## Environment Variables (.env)

### Backend

Die Django-Konfiguration nutzt eine .env-Datei im Verzeichnis backend/.env, um sensible Einstellungen und Umgebungs-spezifische Werte zu verwalten. Diese Datei sollte nicht ins Repository eingecheckt werden (siehe .gitignore).

**Beispiel:** Siehe [backend/.env.example](backend/.env.example)

**Wichtige Variablen:**

- `DEBUG` – Debug-Modus (True/False)
- `SECRET_KEY` – Django Secret Key (unbedingt in Produktion ändern!)
- `ALLOWED_HOSTS` – Erlaubte Hostnamen (kommagetrennt)
- `CORS_ALLOWED_ORIGINS` – Erlaubte Ursprünge für CORS (kommagetrennt)
- `CSRF_TRUSTED_ORIGINS` – Vertrauenswürdige Ursprünge für CSRF (kommagetrennt)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` – Datenbankverbindung

Kopiere backend/.env.example nach backend/.env und passe die Werte an deine Umgebung an.

# OpenFarmPlanner

A full-stack web application for managing CSA (Community Supported Agriculture) farm operations. The application helps manage cultures (crops), beds, fields, planting plans, and tasks with an intuitive interface and automatic harvest date calculations.

## Features

- **Culture Management**: Track different crop varieties with their growing characteristics
- **Growstuff Integration**: Import crop data from Growstuff.org (CC-BY-SA licensed)
- **Farm Organization**: Organize your farm into locations, fields, and beds
- **Planting Plans**: Schedule plantings with automatic harvest date calculation based on crop characteristics
- **RESTful API**: Full CRUD operations for all resources
- **Admin Interface**: Django admin panel for easy data management
- **Responsive UI**: Modern React interface for managing farm operations

## Tech Stack

### Backend
- **Django 5.2.9**: Web framework
- **Django REST Framework 3.16**: API framework
- **django-cors-headers**: CORS support for frontend integration
- **SQLite**: Database (development)
- **Python 3.12+**: Programming language
- **PDM**: Modern Python package manager

### Frontend
- **Vite**: Build tool
- **React 19**: UI library
- **TypeScript**: Type-safe JavaScript
- **React Router**: Client-side routing
- **Axios**: HTTP client
- **Vitest**: Testing framework

## Project Structure

```
OpenFarmPlanner/
├── backend/              # Django backend
│   ├── config/          # Django project settings
│   ├── farm/            # Main farm app
│   │   ├── models.py    # Data models
│   │   ├── serializers.py # DRF serializers
│   │   ├── views.py     # API views
│   │   ├── admin.py     # Admin configuration
│   │   ├── urls.py      # URL routing
│   │   └── tests.py     # Tests
│   ├── manage.py        # Django management script
│   ├── pyproject.toml   # PDM project configuration
│   └── .venv/           # Virtual environment (auto-generated)
└── frontend/            # React frontend
    ├── src/
    │   ├── api/         # API client
    │   ├── pages/       # Page components
    │   ├── __tests__/   # Test files
    │   └── App.tsx      # Main app component
    ├── package.json     # Node dependencies
    └── vite.config.ts   # Vite configuration
```

## Setup Instructions

### Prerequisites
- Python 3.12 or higher
- PDM (Python Dependency Manager)
- Node.js 20 or higher
- npm 10 or higher

### Installing PDM

If you don't have PDM installed:

```bash
pip install --user pdm
```

Or using pipx (recommended):

```bash
pipx install pdm
```

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies with PDM:
```bash
pdm install
```

This will automatically create a virtual environment and install all dependencies.

3. Run migrations:
```bash
pdm run migrate
```

4. Create a superuser (optional, for admin access):
```bash
pdm run createsuperuser
```

5. Run the development server:
```bash
pdm run runserver
```

The API will be available at `http://localhost:8000/api/`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173/`

## Running Tests

### Backend Tests
```bash
cd backend
pdm run test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## API Endpoints

The backend provides the following REST API endpoints:

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
- Growstuff API fields:
  - growstuff_id, source (manual/growstuff), last_synced
  - en_wikipedia_url, perennial, median_lifespan
  - median_days_to_first_harvest, median_days_to_last_harvest

### PlantingPlan
Plan for planting a specific culture in a bed
- culture (FK), bed (FK), planting_date, harvest_date (auto-calculated), quantity, notes

### Task
Farm management tasks
- title, description, planting_plan (FK, optional), due_date, status

## Key Features

### Automatic Harvest Date Calculation
When creating a planting plan, the harvest date is automatically calculated by adding the culture's `days_to_harvest` to the `planting_date`. This can be overridden manually if needed.

### Admin Interface
Access the Django admin at `http://localhost:8000/admin/` to manage all data through a user-friendly interface.

### Growstuff Integration
Import crop data from [Growstuff.org](https://www.growstuff.org), a community-driven database of crops and gardening information.

#### Basic Usage

```bash
cd backend

# Sync all crops from Growstuff API
pdm run python manage.py sync_growstuff_crops

# Sync with a limit (useful for testing)
pdm run python manage.py sync_growstuff_crops --limit 100

# Sync specific crop IDs
pdm run python manage.py sync_growstuff_crops --ids 216,217,218

# Sync single crop by ID
pdm run python manage.py sync_growstuff_crops --ids 216

# Sync and delete unused crops
pdm run python manage.py sync_growstuff_crops --delete-unused

# Custom rate limit (seconds between requests)
pdm run python manage.py sync_growstuff_crops --rate-limit 2.0
```

#### Command Options

- `--limit N`: Fetch only first N crops (efficient for testing)
- `--ids ID1,ID2,...`: Sync specific crops by their Growstuff IDs
- `--delete-unused`: Remove Growstuff crops not in API and not used locally
- `--rate-limit SECONDS`: Set delay between API requests (default: 1.0)
- `--base-url URL`: Custom Growstuff API base URL

#### What Gets Synced

The integration imports complete crop data including:
- Crop name
- English Wikipedia URL
- Perennial status
- Median lifespan
- Median days to first harvest
- Median days to last harvest

The sync operation:
1. Creates new crops not in the local database
2. Updates existing crops imported from Growstuff
3. Preserves manually created crops (never overwrites)
4. Optionally removes unused Growstuff crops

**Data License**: All data from Growstuff is licensed under CC-BY-SA (Creative Commons Attribution-ShareAlike). Attribution to Growstuff.org is required when using this data.

For detailed information, see [backend/GROWSTUFF_INTEGRATION.md](backend/GROWSTUFF_INTEGRATION.md).

## Development

### Backend Development
- Models are defined in `backend/farm/models.py`
- API views use Django REST Framework's ViewSets in `backend/farm/views.py`
- Admin interface is configured in `backend/farm/admin.py`

### Frontend Development
- Pages are in `frontend/src/pages/`
- API client is in `frontend/src/api/client.ts`
- Tests are in `frontend/src/__tests__/`

## Building for Production

### Backend
```bash
cd backend
source venv/bin/activate
python manage.py collectstatic
# Configure production settings (SECRET_KEY, DEBUG=False, etc.)
```

### Frontend
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## License

This project is open source and available for use.

