# Growstuff API Integration

This document describes the integration with the Growstuff API for importing crop/culture data.

## Overview

OpenFarmPlanner integrates with [Growstuff.org](https://www.growstuff.org) to import crop data. Growstuff is a community-driven database of crops and gardening information.

## Data Licensing and Attribution

### License

All data imported from Growstuff is licensed under **CC-BY-SA (Creative Commons Attribution-ShareAlike)**. This means:

- **Attribution Required**: You must give appropriate credit to Growstuff.org
- **ShareAlike**: If you remix, transform, or build upon the material, you must distribute your contributions under the same license
- **Commercial Use**: Allowed with proper attribution

### Attribution Requirements

When using data from Growstuff, you must provide attribution. A proper attribution includes:

1. The name of the creator: "Growstuff.org"
2. A link to the source: https://www.growstuff.org
3. The license name and link: CC-BY-SA (https://creativecommons.org/licenses/by-sa/4.0/)

**Example Attribution:**
```
Crop data from Growstuff.org (https://www.growstuff.org)
Licensed under CC-BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
```

This attribution is automatically added to the `notes` field of imported crops.

## API Usage Policy

The integration is designed to respect Growstuff's API usage policies:

### Rate Limiting

**Important**: As per Growstuff's Terms of Service: "Don't overload our servers. You agree to limit your access to the API in such a way as to prevent excessive load on the Service."

- Default rate limit: 1 request per second (conservative to prevent server overload)
- Configurable via `--rate-limit` parameter (increase with caution)
- Built-in backoff and retry mechanisms
- Growstuff reserves the right to restrict or rate-limit access if necessary

**Best Practices**:
- Use the default rate limit (1 req/sec) for regular syncs
- Run syncs during off-peak hours when possible
- Use `--limit` parameter for testing to avoid unnecessary API calls
- Monitor for rate limit errors and adjust accordingly

### Privacy

- No personal data is collected or transmitted
- Only public crop data is accessed
- User privacy is maintained

### Fair Use

- Use the API responsibly
- Don't make excessive requests
- Cache data locally when possible
- Consider the impact on Growstuff's infrastructure

## Usage

### Syncing Crops

To sync crops from Growstuff API:

```bash
cd backend
pdm run python manage.py sync_growstuff_crops
```

### Command Options

```bash
# Sync with deletion of unused crops
pdm run python manage.py sync_growstuff_crops --delete-unused

# Limit number of crops (for testing)
# This limits API calls - only fetches the specified number of crops
pdm run python manage.py sync_growstuff_crops --limit 100

# For quick testing with minimal API calls
pdm run python manage.py sync_growstuff_crops --limit 1

# Custom rate limit (2 seconds between requests)
pdm run python manage.py sync_growstuff_crops --rate-limit 2.0

# Custom API base URL
pdm run python manage.py sync_growstuff_crops --base-url https://custom.api.url/v1
```

**Note on `--limit`**: The limit parameter now efficiently stops fetching from the API once the limit is reached, rather than fetching all crops and then limiting. This makes testing with small limits (e.g., `--limit 1`) very fast.

### What Gets Synced

The sync operation:

1. **Fetches** all crops from the Growstuff API
2. **Creates** new cultures for crops not in the local database
3. **Updates** existing cultures that were previously imported from Growstuff
4. **Skips** cultures that were manually created (preserves local data)
5. **Optionally deletes** Growstuff crops that are no longer in the API and not used locally

### Data Mapping

Growstuff API fields are mapped to Culture model fields as follows:

| Growstuff Field | Culture Field | Notes |
|----------------|---------------|-------|
| `id` | `growstuff_id` | Unique Growstuff crop ID |
| `name` | `name` | Crop name |
| `slug` | `growstuff_slug` | URL-friendly identifier |
| `days_to_harvest` | `days_to_harvest` | Days from planting to harvest |
| - | `source` | Set to 'growstuff' for API imports |
| - | `last_synced` | Timestamp of last sync |

## Model Changes

The `Culture` model has been extended with the following fields:

- `growstuff_id`: Integer, unique, nullable - Growstuff API crop ID
- `growstuff_slug`: CharField, nullable - Growstuff URL slug
- `source`: CharField with choices ('manual', 'growstuff') - Data source
- `last_synced`: DateTimeField, nullable - Last sync timestamp

## API Client

The `GrowstuffClient` class in `farm/growstuff_client.py` provides:

- Rate-limited API requests
- Automatic pagination handling
- Error handling and retry logic
- Connection pooling for efficiency

### Example Usage

```python
from farm.growstuff_client import GrowstuffClient

# Using context manager (recommended)
with GrowstuffClient() as client:
    crops = client.get_all_crops()
    for crop in crops:
        print(crop['name'])

# Manual usage
client = GrowstuffClient(rate_limit_delay=1.5)
try:
    crop = client.get_crop_by_id(123)
    print(crop)
finally:
    client.close()
```

## Creating New Crops in Growstuff

If you have all required fields for a new crop, consider creating it directly in Growstuff:

1. Visit https://www.growstuff.org
2. Create an account or log in
3. Navigate to "Add a Crop"
4. Fill in the required information
5. Submit the crop

Benefits:
- Contributes to the community database
- Ensures consistency across all users
- Automatic availability in future syncs

## Troubleshooting

### HTTP 406 Not Acceptable Error

**FIXED**: This error occurred because the Growstuff API requires the `.json` extension for JSON responses (Rails convention).

### HTTP 400 Bad Request Error

**FIXED**: This error occurred because the API uses JSON:API specification format. The correct pagination parameters are `page[number]` and `page[size]` (not `page` and `per_page`).

The Growstuff API follows the **JSON:API specification** (https://jsonapi.org/):
- Content-Type: `application/vnd.api+json`
- Pagination: `page[number]` and `page[size]` parameters
- Response structure: `{"data": [], "meta": {}, "links": {}}`
- Crop attributes are nested: `data[].attributes.name`, `data[].attributes.median_days_to_first_harvest`, etc.

### Rate Limit Errors

If you encounter rate limit errors:
- Increase the `--rate-limit` parameter (e.g., `--rate-limit 2.0`)
- Run the sync during off-peak hours
- Contact Growstuff if you need higher limits for legitimate use

### Missing Fields

If `days_to_harvest` is not available from the API:
- Default value of 60 days is used
- You can manually update the value after import
- Consider contributing the data back to Growstuff

### Network Errors

If the API is unreachable:
- Check your internet connection
- Verify the API URL is correct
- Check Growstuff's status page for outages
- Ensure your firewall allows HTTPS connections

## Development

### Testing

To test the API client with mocked responses:

```bash
cd backend
pdm run python manage.py test farm.tests.test_growstuff_client
```

### Adding New Fields

To sync additional fields from Growstuff:

1. Update the `Culture` model in `farm/models.py`
2. Create and run migrations
3. Update `_upsert_crop()` in the management command
4. Update this documentation

## API Documentation

For detailed API documentation, see:
https://www.growstuff.org/api-docs/index.html

## License Compliance Checklist

When using Growstuff data, ensure:

- [ ] Attribution is provided to Growstuff.org
- [ ] License (CC-BY-SA) is mentioned
- [ ] Link to Growstuff.org is included
- [ ] If data is modified, it's shared under the same license
- [ ] Users are aware of the licensing terms

## Support

- Growstuff Website: https://www.growstuff.org
- Growstuff Community: https://www.growstuff.org/community
- OpenFarmPlanner Issues: https://github.com/stipsitzm/OpenFarmPlanner/issues
