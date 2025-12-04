# OpenFarm Culture Import

This document describes how to use the OpenFarm plant data import functionality in TinyFarm.

## Overview

TinyFarm's Culture model has been extended to support OpenFarm plant data, allowing you to import comprehensive crop information from OpenFarm's database. The system preserves all original OpenFarm data while also mapping it to TinyFarm's specific fields for farm management.

## Culture Model Fields

The Culture model now includes:

### Core Fields (Original)
- `name`: Crop name (required)
- `variety`: Specific variety/cultivar (optional)
- `days_to_harvest`: Days from planting to harvest (backward compatible)
- `notes`: Additional notes

### CSA Farm Management Fields
- `plant_spacing_cm`: Distance between plants in centimeters
- `row_spacing_cm`: Distance between rows in centimeters
- `maturity_days`: Days to maturity (preferred over days_to_harvest)
- `yield_kg_per_m2`: Expected yield in kg/m²
- `planting_labor_min_per_m2`: Labor minutes per m² for planting
- `harvest_labor_min_per_m2`: Labor minutes per m² for harvesting
- `hilling_labor_min_per_m2`: Labor minutes per m² for hilling

### OpenFarm Fields
- `openfarm_id`: OpenFarm unique identifier (used for upserts)
- `openfarm_slug`: URL-friendly slug
- `binomial_name`: Scientific binomial name
- `common_names`: JSON array of common names in different languages
- `sun_requirements`: Sun exposure requirements
- `sowing_method`: Method of sowing (direct seed, transplant, etc.)
- `spread_cm`: Plant spread/width in centimeters
- `height_cm`: Plant height in centimeters
- `growing_degree_days`: Growing degree days requirement
- `taxon`: Taxonomic rank (Species, Genus, Family, etc.)
- `description`: Detailed description
- `openfarm_raw`: Complete raw JSON from OpenFarm (preserves all data)

## Management Commands

### 1. Download OpenFarm Plants Data

Download the OpenFarm plants database:

```bash
cd backend
pdm run python manage.py download_openfarm_plants
```

Options:
- `--url URL`: Custom URL to download from
- `--output PATH`: Custom output path

Example:
```bash
pdm run python manage.py download_openfarm_plants --url https://example.com/plants.json --output /tmp/plants.json
```

**Note**: OpenFarm uses MongoDB and doesn't have a plants.json file in their GitHub repository. You'll need to either:
1. Use a custom URL to a JSON export
2. Create a local plants.json file manually
3. Use the sample file provided at `data/openfarm/plants.json`

### 2. Import Cultures from Plants Data

Import or update cultures from the plants.json file:

```bash
cd backend
pdm run python manage.py import_openfarm_cultures
```

Options:
- `--file PATH`: Path to plants.json file (default: `data/openfarm/plants.json`)
- `--dry-run`: Parse and validate without saving to database
- `--verbose`: Show detailed output for each plant

Examples:

```bash
# Dry run to preview import
pdm run python manage.py import_openfarm_cultures --dry-run --verbose

# Import with detailed output
pdm run python manage.py import_openfarm_cultures --verbose

# Import from custom file
pdm run python manage.py import_openfarm_cultures --file /path/to/plants.json
```

## Plants.json Format

The expected format for plants.json is an array of plant objects:

```json
[
  {
    "_id": "tomato-1",
    "name": "Tomato",
    "slug": "tomato",
    "binomial_name": "Solanum lycopersicum",
    "common_names": ["Tomato", "Tomate", "Pomodoro"],
    "description": "The tomato is the edible berry...",
    "sun_requirements": "full sun",
    "sowing_method": "transplant",
    "spread": 60,
    "row_spacing": 90,
    "height": 150,
    "growing_degree_days": 1500,
    "taxon": "Species",
    "cultivar_name": "Cherry",
    "tags_array": ["vegetable", "fruit"]
  }
]
```

### Required Fields
- `name`: Plant name (string)

### Optional Fields
All other fields are optional and will be mapped when present.

## Upsert Logic

The import command uses "upsert" logic (update or insert):

1. If `openfarm_id` is present, it's used as the unique key
2. Otherwise, the combination of `(name, variety)` is used

This means:
- Running the import multiple times is safe
- Existing cultures are updated with new data
- New cultures are created as needed

## Data Mapping

The mapping function (`map_openfarm_plant_to_culture`) handles:

1. **Field name translation**: OpenFarm fields → TinyFarm fields
2. **Type conversion**: String/integer conversion, array handling
3. **Default values**: Derived fields (e.g., plant_spacing_cm from spread)
4. **Data preservation**: Complete OpenFarm data stored in `openfarm_raw`

## Examples

### Import Sample Data

A sample plants.json with 5 crops is provided:

```bash
cd backend
pdm run python manage.py import_openfarm_cultures --verbose
```

Output:
```
Reading plants data from: .../data/openfarm/plants.json
Found 5 plants to process
  Processing: Tomato ✓ Created
  Processing: Lettuce ✓ Created
  Processing: Carrot ✓ Created
  Processing: Tomato (Cherry) ✓ Created
  Processing: Basil ✓ Created

============================================================
Import Summary:
============================================================
Total processed: 5
  Created: 5
  Updated: 0
```

### Update Existing Data

Modify plants.json and re-run:

```bash
pdm run python manage.py import_openfarm_cultures --verbose
```

Output:
```
...
  Processing: Tomato ✓ Updated
  Processing: Lettuce ✓ Updated
...
Total processed: 5
  Created: 0
  Updated: 5
```

## Python API

You can also use the import functions directly in Python:

```python
from farm.openfarm_import import map_openfarm_plant_to_culture, get_upsert_key
from farm.models import Culture

# Map plant data
plant_data = {
    '_id': 'basil-1',
    'name': 'Basil',
    'binomial_name': 'Ocimum basilicum',
    'spread': 30,
}

culture_data = map_openfarm_plant_to_culture(plant_data)

# Upsert
lookup_key = get_upsert_key(culture_data)
culture, created = Culture.objects.update_or_create(
    **lookup_key,
    defaults=culture_data
)
```

## Testing

Run the test suite:

```bash
cd backend
pdm run test
```

Tests include:
- Field mapping validation
- Upsert key generation
- Database operations
- Edge cases and error handling

## Migration

The new fields were added via Django migration `0002_culture_binomial_name_culture_common_names_and_more.py`. All fields are nullable to preserve existing data.

To apply migrations:

```bash
cd backend
pdm run migrate
```

## Notes

1. **OpenFarm Structure**: OpenFarm uses MongoDB, not a static JSON file. The sample plants.json was created based on OpenFarm's Crop model structure.

2. **Data Source**: For production use, you'll need to export data from OpenFarm's MongoDB or use their API.

3. **Backward Compatibility**: The `days_to_harvest` field remains for backward compatibility. The `get_days_to_harvest()` method prefers `maturity_days` if set.

4. **JSON Fields**: The `common_names` and `openfarm_raw` fields use Django's JSONField, which requires SQLite 3.9.0+ or PostgreSQL.

5. **Labor Fields**: The CSA farm management fields (labor minutes, yield) must be set manually as they're not in OpenFarm's standard schema.
