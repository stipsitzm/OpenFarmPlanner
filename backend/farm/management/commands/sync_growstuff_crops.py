"""
Django management command to sync crops from Growstuff API.

This command fetches crop data from the Growstuff API and synchronizes
it with the local Culture model. It handles creating new crops, updating
existing ones, and optionally removing crops that have been deleted from
Growstuff (if they are not in use locally).

Usage:
    python manage.py sync_growstuff_crops
    python manage.py sync_growstuff_crops --delete-unused
    python manage.py sync_growstuff_crops --limit 100

Data Attribution:
    All data imported from Growstuff is licensed under CC-BY-SA
    (Creative Commons Attribution-ShareAlike). When using this data,
    you must provide attribution to Growstuff.org.
"""

import logging
from typing import Dict, Any, Set
from datetime import datetime, timezone

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.utils import timezone as django_timezone

from farm.models import Culture
from farm.growstuff_client import GrowstuffClient, GrowstuffAPIError


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Django management command to sync crops from Growstuff API.
    
    This command fetches crop data from the Growstuff API and performs
    intelligent upsert operations to keep local data in sync with the
    upstream source while preserving local customizations.
    """
    
    help = (
        'Sync crop data from Growstuff API. '
        'Data is licensed under CC-BY-SA and requires attribution to Growstuff.org'
    )
    
    def add_arguments(self, parser: CommandParser) -> None:
        """
        Add command-line arguments.
        
        :param parser: The argument parser to configure
        """
        parser.add_argument(
            '--delete-unused',
            action='store_true',
            help='Delete crops from Growstuff that are not used in any planting plans'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit the number of crops to sync (for testing)'
        )
        parser.add_argument(
            '--base-url',
            type=str,
            default='https://www.growstuff.org/api/v1',
            help='Base URL for Growstuff API (default: https://www.growstuff.org/api/v1)'
        )
        parser.add_argument(
            '--rate-limit',
            type=float,
            default=1.0,
            help='Minimum seconds between API requests (default: 1.0)'
        )
    
    def handle(self, *args: Any, **options: Any) -> None:
        """
        Execute the command.
        
        :param args: Positional arguments
        :param options: Command options from argparse
        """
        delete_unused = options['delete_unused']
        limit = options['limit']
        base_url = options['base_url']
        rate_limit = options['rate_limit']
        
        self.stdout.write(self.style.NOTICE('Starting Growstuff crop sync...'))
        self.stdout.write(self.style.NOTICE(
            'Data License: CC-BY-SA (Creative Commons Attribution-ShareAlike)'
        ))
        self.stdout.write(self.style.NOTICE(
            'Attribution: Data from Growstuff.org (https://www.growstuff.org)'
        ))
        
        try:
            with GrowstuffClient(base_url=base_url, rate_limit_delay=rate_limit) as client:
                # Fetch all crops from Growstuff
                self.stdout.write('Fetching crops from Growstuff API...')
                crops = client.get_all_crops()
                
                if limit:
                    crops = crops[:limit]
                    self.stdout.write(f'Limited to first {limit} crops for testing')
                
                self.stdout.write(f'Fetched {len(crops)} crops from Growstuff')
                
                # Sync crops to database
                stats = self._sync_crops(crops)
                
                # Handle deletions if requested
                if delete_unused:
                    deleted = self._delete_unused_crops(crops)
                    stats['deleted'] = deleted
                
                # Display results
                self._display_stats(stats)
                
        except GrowstuffAPIError as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to fetch crops from Growstuff API: {str(e)}')
            )
            raise
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Unexpected error during sync: {str(e)}')
            )
            raise
    
    def _sync_crops(self, crops: list) -> Dict[str, int]:
        """
        Sync crops from Growstuff API to local database.
        
        Performs upsert operations (update or insert) for each crop.
        
        :param crops: List of crop dictionaries from Growstuff API
        :return: Dictionary with statistics (created, updated, skipped)
        """
        created = 0
        updated = 0
        skipped = 0
        
        for crop_data in crops:
            try:
                result = self._upsert_crop(crop_data)
                if result == 'created':
                    created += 1
                elif result == 'updated':
                    updated += 1
                else:
                    skipped += 1
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'Error processing crop {crop_data.get("id", "unknown")}: {str(e)}')
                )
                skipped += 1
        
        return {
            'created': created,
            'updated': updated,
            'skipped': skipped,
            'total': len(crops)
        }
    
    def _upsert_crop(self, crop_data: Dict[str, Any]) -> str:
        """
        Create or update a single crop from Growstuff data.
        
        :param crop_data: Crop data dictionary from Growstuff API
        :return: 'created', 'updated', or 'skipped'
        """
        # Extract data from Growstuff API response
        growstuff_id = crop_data.get('id')
        name = crop_data.get('name', '').strip()
        slug = crop_data.get('slug', '')
        
        # Validate required fields
        if not growstuff_id or not name:
            logger.warning(f"Skipping crop with missing required fields: {crop_data}")
            return 'skipped'
        
        # Get or create the culture
        try:
            culture = Culture.objects.get(growstuff_id=growstuff_id)
            
            # Only update if this is from Growstuff (don't overwrite manual entries)
            if culture.source == 'growstuff':
                # Update fields
                old_name = culture.name
                culture.name = name
                culture.growstuff_slug = slug
                
                # Try to extract days_to_harvest if available
                # Note: Growstuff API may provide this in various formats
                days_to_harvest = self._extract_days_to_harvest(crop_data)
                if days_to_harvest:
                    culture.days_to_harvest = days_to_harvest
                
                # Update sync timestamp
                culture.last_synced = django_timezone.now()
                culture.save()
                
                if old_name != name:
                    logger.info(f"Updated crop: {old_name} -> {name}")
                
                return 'updated'
            else:
                # Don't overwrite manual entries
                logger.debug(f"Skipping manual entry for {name} (ID: {growstuff_id})")
                return 'skipped'
                
        except Culture.DoesNotExist:
            # Create new culture
            days_to_harvest = self._extract_days_to_harvest(crop_data)
            if not days_to_harvest:
                # Default to a reasonable value if not provided
                days_to_harvest = 60
                logger.debug(f"Using default days_to_harvest for {name}")
            
            culture = Culture.objects.create(
                name=name,
                growstuff_id=growstuff_id,
                growstuff_slug=slug,
                source='growstuff',
                days_to_harvest=days_to_harvest,
                last_synced=django_timezone.now(),
                notes=f"Imported from Growstuff.org. License: CC-BY-SA"
            )
            
            logger.info(f"Created new crop: {name}")
            return 'created'
    
    def _extract_days_to_harvest(self, crop_data: Dict[str, Any]) -> int:
        """
        Extract days to harvest from crop data.
        
        Growstuff API may provide this information in various formats.
        This method attempts to extract it intelligently.
        
        :param crop_data: Crop data dictionary from Growstuff API
        :return: Days to harvest, or 0 if not found
        """
        # Try different possible field names
        possible_fields = [
            'days_to_harvest',
            'days_to_maturity',
            'maturity_days',
            'harvest_days'
        ]
        
        for field in possible_fields:
            value = crop_data.get(field)
            if value and isinstance(value, (int, float)):
                return int(value)
            elif value and isinstance(value, str):
                try:
                    return int(value)
                except ValueError:
                    continue
        
        # If not found, try to extract from description or other text fields
        # (This is speculative - actual API structure may differ)
        
        return 0
    
    def _delete_unused_crops(self, api_crops: list) -> int:
        """
        Delete crops that are no longer in Growstuff API and not in use.
        
        :param api_crops: List of crop dictionaries from Growstuff API
        :return: Number of crops deleted
        """
        # Get all Growstuff IDs from API
        api_ids: Set[int] = {crop.get('id') for crop in api_crops if crop.get('id')}
        
        # Find local Growstuff crops that are no longer in API
        deleted_count = 0
        
        for culture in Culture.objects.filter(source='growstuff'):
            if culture.growstuff_id not in api_ids:
                # Check if this crop is used in any planting plans
                if not culture.planting_plans.exists():
                    logger.info(f"Deleting unused crop: {culture.name} (Growstuff ID: {culture.growstuff_id})")
                    culture.delete()
                    deleted_count += 1
                else:
                    logger.debug(
                        f"Keeping crop {culture.name} (Growstuff ID: {culture.growstuff_id}) - "
                        f"used in {culture.planting_plans.count()} planting plans"
                    )
        
        return deleted_count
    
    def _display_stats(self, stats: Dict[str, int]) -> None:
        """
        Display sync statistics to the console.
        
        :param stats: Dictionary with sync statistics
        """
        self.stdout.write(self.style.SUCCESS('\nSync completed successfully!'))
        self.stdout.write(f'Total crops processed: {stats["total"]}')
        self.stdout.write(self.style.SUCCESS(f'Created: {stats["created"]}'))
        self.stdout.write(self.style.SUCCESS(f'Updated: {stats["updated"]}'))
        self.stdout.write(f'Skipped: {stats["skipped"]}')
        
        if 'deleted' in stats:
            self.stdout.write(self.style.WARNING(f'Deleted: {stats["deleted"]}'))
        
        self.stdout.write('\n' + self.style.NOTICE('Attribution Required:'))
        self.stdout.write('Data from Growstuff.org - Licensed under CC-BY-SA')
        self.stdout.write('Please ensure proper attribution when using this data.')
