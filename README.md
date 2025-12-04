# TinyFarm

A full-stack web application for managing CSA (Community Supported Agriculture) farm operations. The application helps manage cultures (crops), beds, fields, planting plans, and tasks with an intuitive interface and automatic harvest date calculations.

## Features

- **Culture Management**: Track different crop varieties with their growing characteristics
- **Farm Organization**: Organize your farm into locations, fields, and beds
- **Planting Plans**: Schedule plantings with automatic harvest date calculation based on crop characteristics
- **Task Management**: Track farm tasks and activities
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
TinyFarm/
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

**Important:** If you pull updates to the code, always run migrations to update your database schema:
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

### OpenFarm Data Import (Optional)

To import plant data from OpenFarm:

1. The sample plants.json is included at `data/openfarm/plants.json`
2. Import cultures:
```bash
cd backend
pdm run python manage.py import_openfarm_cultures --verbose
```

For more options and details, see [backend/README_OPENFARM.md](backend/README_OPENFARM.md)

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
A crop or plant type with comprehensive growing information
- **Core fields**: name, variety, days_to_harvest, notes
- **CSA farm fields**: plant_spacing_cm, row_spacing_cm, maturity_days, yield_kg_per_m2, labor fields
- **OpenFarm fields**: openfarm_id, binomial_name, common_names, sun_requirements, sowing_method, spread_cm, height_cm, growing_degree_days, taxon, description
- **Raw data**: openfarm_raw (complete OpenFarm JSON)

See [backend/README_OPENFARM.md](backend/README_OPENFARM.md) for details on importing OpenFarm plant data.

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

