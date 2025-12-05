# Growstuff API Integration - Implementation Summary

## Overview

This implementation adds complete integration with the Growstuff.org API to import crop/culture data into OpenFarmPlanner. The integration respects all Growstuff API policies, including data licensing, rate limiting, and privacy requirements.

## Files Created/Modified

### New Files
1. **backend/farm/growstuff_client.py** (240 lines)
   - API client with rate limiting and error handling
   - Supports pagination and bulk fetching
   - Context manager support for resource cleanup

2. **backend/farm/management/commands/sync_growstuff_crops.py** (320 lines)
   - Django management command for syncing crops
   - Intelligent upsert logic
   - Optimized deletion with Exists subquery

3. **backend/farm/test_growstuff_client.py** (270 lines)
   - 13 comprehensive tests for API client
   - Mocked responses for isolation

4. **backend/farm/test_sync_command.py** (380 lines)
   - 15 comprehensive tests for management command
   - Tests for create, update, delete, and edge cases

5. **backend/GROWSTUFF_INTEGRATION.md** (200 lines)
   - Complete documentation
   - Usage instructions
   - Licensing information
   - Troubleshooting guide

6. **backend/farm/management/__init__.py** and **backend/farm/management/commands/__init__.py**
   - Package initialization files

7. **backend/farm/migrations/0002_culture_growstuff_id_culture_growstuff_slug_and_more.py**
   - Database migration for new Culture fields

### Modified Files
1. **backend/farm/models.py**
   - Added 4 new fields to Culture model:
     - growstuff_id (IntegerField, unique, nullable)
     - growstuff_slug (CharField, nullable)
     - source (CharField with choices: manual/growstuff)
     - last_synced (DateTimeField, nullable)

2. **backend/pyproject.toml**
   - Added dependencies: requests, python-dotenv

3. **README.md**
   - Added Growstuff integration to features list
   - Added Growstuff Integration section with usage
   - Updated Culture model documentation

## Key Features Implemented

### 1. Growstuff API Client
- **Rate Limiting**: Default 1 second between requests (configurable)
- **Error Handling**: Graceful handling of timeouts, rate limits, and network errors
- **Pagination**: Automatic handling of paginated responses
- **Connection Pooling**: Efficient reuse of HTTP connections
- **Context Manager**: Proper resource cleanup

### 2. Sync Management Command
- **Intelligent Upsert**: 
  - Creates new crops from Growstuff
  - Updates existing Growstuff crops
  - Preserves manual entries (never overwrites)
- **Optional Deletion**: Can remove Growstuff crops no longer in API
- **Safety**: Only deletes unused crops (not in any planting plans)
- **Performance**: Optimized queries using Exists subquery and bulk delete
- **Configurable**: Multiple command-line options

### 3. Data Attribution
- All imported crops include CC-BY-SA license notice
- Attribution to Growstuff.org in notes field
- Documentation clearly states licensing requirements
- Command output reminds users of attribution requirements

### 4. Comprehensive Testing
- **40 total tests** (12 original + 28 new)
- **100% pass rate**
- Mocked API responses for isolation
- Edge cases covered (missing fields, duplicates, etc.)
- Performance optimization tested

### 5. Security
- **CodeQL scan**: 0 alerts
- No SQL injection vulnerabilities
- Proper input validation
- Safe API request handling

## Usage

### Basic Sync
```bash
cd backend
pdm run python manage.py sync_growstuff_crops
```

### With Options
```bash
# Delete crops removed from Growstuff (if unused)
pdm run python manage.py sync_growstuff_crops --delete-unused

# Limit for testing
pdm run python manage.py sync_growstuff_crops --limit 100

# Custom rate limit
pdm run python manage.py sync_growstuff_crops --rate-limit 2.0
```

## Data Model Changes

### Culture Model Extensions
```python
growstuff_id = models.IntegerField(null=True, blank=True, unique=True)
growstuff_slug = models.CharField(max_length=200, blank=True)
source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
last_synced = models.DateTimeField(null=True, blank=True)
```

## API Client Architecture

### Class Structure
```
GrowstuffClient
├── __init__() - Initialize with configuration
├── _apply_rate_limit() - Enforce rate limiting
├── _make_request() - Base HTTP request handler
├── get_crops() - Fetch single page
├── get_all_crops() - Fetch all pages (pagination)
├── get_crop_by_id() - Fetch specific crop
└── close() - Cleanup resources
```

### Error Handling
- `GrowstuffAPIError`: Base exception for API errors
- `GrowstuffRateLimitError`: Rate limit exceeded
- Proper logging at all levels

## Sync Command Logic

### Flow
1. Fetch all crops from Growstuff API
2. For each crop:
   - Check if exists by growstuff_id
   - If exists and source='growstuff': update
   - If exists and source='manual': skip
   - If not exists: create with source='growstuff'
3. If --delete-unused:
   - Find Growstuff crops not in API
   - Check if used in planting plans
   - Delete only unused crops

### Performance Optimizations
- Bulk operations where possible
- Exists subquery for filtering
- Prefetch related for logging
- Minimal database queries

## Documentation

### User Documentation
- **GROWSTUFF_INTEGRATION.md**: Complete guide
  - Overview and licensing
  - Usage instructions
  - Configuration options
  - Troubleshooting
  - API documentation links

### Code Documentation
- All functions have docstrings (PEP 257)
- Type hints throughout (PEP 484)
- Inline comments for complex logic
- README updated with integration info

## Testing Strategy

### API Client Tests (13 tests)
- Initialization
- Rate limiting behavior
- Successful requests
- Error handling (rate limit, timeout, general)
- Pagination (single/multiple pages)
- Context manager
- Edge cases (empty response, max per_page)

### Management Command Tests (15 tests)
- Field extraction logic
- Crop creation from API data
- Crop updates
- Manual entry protection
- Missing field handling
- Default value usage
- Bulk sync statistics
- Deletion logic (unused, in-use, manual)
- Command execution with options
- Full integration scenarios

## Compliance Checklist

- ✅ CC-BY-SA license attribution in all imported data
- ✅ Attribution to Growstuff.org documented
- ✅ Rate limiting implemented and configurable
- ✅ Privacy preserved (no personal data collected)
- ✅ API usage policy respected
- ✅ Error handling prevents abuse
- ✅ Documentation includes licensing info
- ✅ Users informed of attribution requirements

## Future Enhancements

Potential improvements for future iterations:

1. **Scheduling**: Add periodic sync via cron/celery
2. **Webhooks**: Listen for Growstuff updates
3. **Incremental Sync**: Track last sync time, fetch only changes
4. **Conflict Resolution**: UI for resolving sync conflicts
5. **Batch Processing**: Process large syncs in batches
6. **Logging**: Enhanced logging to database for audit trail
7. **Notifications**: Alert on sync failures or conflicts
8. **UI Integration**: Frontend interface for triggering sync

## Technical Decisions

### Why Django Management Command?
- Standard Django pattern for CLI tasks
- Easy to schedule with cron
- Can be run manually or programmatically
- Good error reporting and logging

### Why Requests Library?
- Industry standard for HTTP in Python
- Simple, well-documented API
- Good session/connection pooling
- Easy to test with mocks

### Why Upsert Pattern?
- Handles both new and updated crops
- Prevents duplicates
- Preserves manual customizations
- Atomic operations

### Why Optimized Deletion?
- Performance with large datasets
- Single database query vs N queries
- Scalable solution
- Follows Django best practices

## Conclusion

This implementation provides a robust, well-tested, and documented integration with the Growstuff API. It respects all licensing and usage requirements, includes comprehensive error handling, and is optimized for performance. The code follows Django and Python best practices, with full type hints and documentation.

All tests pass (40/40) and CodeQL security scan shows 0 alerts.
