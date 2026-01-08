# Migration Guide for Culture Model Updates

## Overview
This PR adds 17 new fields to the Culture model for manual planning functionality. To use these features, you **must** apply the database migration.

## Required Steps

### 1. Apply Database Migration

The migration file `0007_culture_allow_deviation_delivery_weeks_and_more.py` has been created and adds all new fields to the database.

**For development (SQLite):**
```bash
cd backend
pdm run migrate
```

**For production (PostgreSQL):**
```bash
cd backend
pdm run migrate
```

### 2. Restart the Backend Server

After applying migrations, restart your Django development server:
```bash
cd backend
pdm run runserver
```

### 3. Clear Browser Cache (Optional)

If you experience issues with the frontend, clear your browser cache or do a hard refresh:
- Chrome/Edge: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Firefox: `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)

## What This Migration Adds

The migration adds the following fields to the `Culture` model:

### Manual Planning Fields
- `crop_family` - CharField for crop rotation planning
- `nutrient_demand` - CharField with choices (low/medium/high)
- `cultivation_type` - CharField with choices (direct sowing/transplant/pre-cultivation)
- `germination_rate` - DecimalField (0-100)
- `safety_margin` - DecimalField (0-100)
- `internal_article_number` - CharField for internal SKU

### Timing Fields (in weeks)
- `growth_duration_weeks` - DecimalField (nullable but required via form/API)
- `harvest_duration_weeks` - DecimalField (nullable but required via form/API)
- `propagation_time_weeks` - DecimalField (optional)

### Harvest Information
- `harvest_method` - CharField with choices (per_plant/per_sqm/per_bed)
- `expected_yield` - DecimalField
- `required_yield_per_share_per_week` - DecimalField
- `allow_deviation_delivery_weeks` - BooleanField (default: False)

### Planting Distances (in cm)
- `distance_within_row_cm` - DecimalField
- `row_spacing_cm` - DecimalField
- `sowing_depth_cm` - DecimalField

### Display Settings
- `display_color` - CharField for hex color (#RRGGBB)

## Backward Compatibility

### Existing Data
- All existing cultures will have `NULL` values for the new fields
- The API and UI will work with existing cultures
- You can gradually enrich existing cultures with planning data

### Growstuff Integration
- All Growstuff-related fields remain unchanged
- Growstuff data is preserved and read-only via the form
- The `source` field distinguishes between manual and Growstuff entries

## Troubleshooting

### Error: "500 Internal Server Error" when fetching cultures

**Cause:** Database migration has not been applied.

**Solution:**
```bash
cd backend
pdm run migrate
```

### Error: "no such column: farm_culture.growth_duration_weeks"

**Cause:** Database migration has not been applied or was not successful.

**Solution:**
1. Check migration status:
   ```bash
   cd backend
   pdm run python manage.py showmigrations farm
   ```

2. If migration 0007 shows `[ ]` (not applied), run:
   ```bash
   pdm run migrate
   ```

3. If migration shows `[X]` (already applied) but error persists:
   - Check that you're using the correct database
   - For development, ensure `backend/db.sqlite3` exists
   - For production, verify PostgreSQL connection settings

### Error: "Cannot save culture" or validation errors

**Cause:** The new required fields (`growth_duration_weeks`, `harvest_duration_weeks`) must be provided.

**Solution:**
When creating or updating a culture via API, ensure you include:
```json
{
  "name": "Tomato",
  "growth_duration_weeks": 8,
  "harvest_duration_weeks": 4,
  "days_to_harvest": 56
}
```

## Verification

After applying migrations, verify everything works:

1. **Check migration status:**
   ```bash
   cd backend
   pdm run python manage.py showmigrations farm
   ```
   
   You should see:
   ```
   [X] 0007_culture_allow_deviation_delivery_weeks_and_more
   ```

2. **Test API endpoint:**
   ```bash
   curl http://localhost:8000/openfarmplanner/api/cultures/
   ```
   
   Should return a 200 OK response with culture data.

3. **Test UI:**
   - Open the Cultures page in the UI
   - Click "Neue Kultur hinzufügen" (Add New Culture)
   - Form should open with all sections visible

## Support

If you continue to experience issues:
1. Check that the backend server is running
2. Verify migrations are applied: `pdm run python manage.py showmigrations`
3. Check backend logs for detailed error messages
4. Ensure all dependencies are installed: `pdm install`
