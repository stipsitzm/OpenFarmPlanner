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
from django.db.models import Exists, OuterRef
from django.utils import timezone as django_timezone

from farm.models import Culture, PlantingPlan
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
                # Fetch crops from Growstuff
                self.stdout.write('Fetching crops from Growstuff API...')
                
                # Pass limit to API client to avoid fetching all crops when not needed
                crops = client.get_all_crops(max_crops=limit)
                
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
        
        Handles JSON:API format where data is in 'id' and 'attributes' fields.
        
        :param crop_data: Crop data dictionary from Growstuff API (JSON:API format)
        :return: 'created', 'updated', or 'skipped'
        """
        # Extract data from JSON:API response format
        # JSON:API structure: {"id": "123", "attributes": {"name": "Tomato", ...}}
        growstuff_id = crop_data.get('id')
        attributes = crop_data.get('attributes', {})
        
        name = attributes.get('name', '').strip()
        
        # Validate required fields
        if not growstuff_id or not name:
            logger.warning(f"Skipping crop with missing required fields: {crop_data}")
            return 'skipped'
        
        # Convert string ID to integer if needed
        try:
            growstuff_id = int(growstuff_id)
        except (ValueError, TypeError):
            logger.warning(f"Invalid growstuff_id format: {growstuff_id}")
            return 'skipped'
        
        # Get or create the culture
        try:
            culture = Culture.objects.get(growstuff_id=growstuff_id)
            
            # Only update if this is from Growstuff (don't overwrite manual entries)
            if culture.source == 'growstuff':
                # Update fields
                old_name = culture.name
                culture.name = name
                # Note: slug is not in the attributes, use a generated one or empty
                
                # Try to extract days_to_harvest from attributes
                days_to_harvest = self._extract_days_to_harvest(attributes)
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
            days_to_harvest = self._extract_days_to_harvest(attributes)
            if not days_to_harvest:
                # Default to a reasonable value if not provided
                days_to_harvest = 60
                logger.debug(f"Using default days_to_harvest for {name}")
            
            culture = Culture.objects.create(
                name=name,
                growstuff_id=growstuff_id,
                growstuff_slug='',  # Slug not provided in JSON:API response
                source='growstuff',
                days_to_harvest=days_to_harvest,
                last_synced=django_timezone.now(),
                notes=f"Imported from Growstuff.org. License: CC-BY-SA"
            )
            
            logger.info(f"Created new crop: {name}")
            return 'created'
    
    def _extract_days_to_harvest(self, attributes: Dict[str, Any]) -> int:
        """
        Extract days to harvest from crop attributes.
        
        Growstuff API provides median_days_to_first_harvest and median_days_to_last_harvest.
        This method extracts the first harvest timing as days_to_harvest.
        
        :param attributes: Crop attributes dictionary from Growstuff API (JSON:API format)
        :return: Days to harvest, or 0 if not found
        """
        # Check for Growstuff's specific fields first
        # median_days_to_first_harvest is the most relevant
        first_harvest = attributes.get('median_days_to_first_harvest')
        if first_harvest and isinstance(first_harvest, (int, float)) and first_harvest > 0:
            return int(first_harvest)
        
        # Fall back to last harvest if first not available
        last_harvest = attributes.get('median_days_to_last_harvest')
        if last_harvest and isinstance(last_harvest, (int, float)) and last_harvest > 0:
            return int(last_harvest)
        
        # Try other possible field names as fallback
        possible_fields = [
            'days_to_harvest',
            'days_to_maturity',
            'maturity_days',
            'harvest_days'
        ]
        
        for field in possible_fields:
            value = attributes.get(field)
            if value and isinstance(value, (int, float)) and value > 0:
                return int(value)
            elif value and isinstance(value, str):
                try:
                    parsed = int(value)
                    if parsed > 0:
                        return parsed
                except ValueError:
                    continue
        
        return 0
    
    def _delete_unused_crops(self, api_crops: list) -> int:
        """
        Delete crops that are no longer in Growstuff API and not in use.
        
        Uses optimized queries with prefetch_related and Exists subquery
        to minimize database hits.
        
        :param api_crops: List of crop dictionaries from Growstuff API
        :return: Number of crops deleted
        """
        # Get all Growstuff IDs from API
        api_ids: Set[int] = {crop.get('id') for crop in api_crops if crop.get('id')}
        
        # Find local Growstuff crops that are no longer in API and not in use
        # Use Exists subquery for efficient filtering
        has_planting_plans = PlantingPlan.objects.filter(culture=OuterRef('pk'))
        
        # Get cultures to delete: from Growstuff, not in API, and no planting plans
        cultures_to_delete = Culture.objects.filter(
            source='growstuff'
        ).exclude(
            growstuff_id__in=api_ids
        ).exclude(
            Exists(has_planting_plans)
        )
        
        # Log what we're about to delete
        deleted_count = 0
        for culture in cultures_to_delete:
            logger.info(f"Deleting unused crop: {culture.name} (Growstuff ID: {culture.growstuff_id})")
            deleted_count += 1
        
        # Perform bulk delete
        cultures_to_delete.delete()
        
        # Log kept cultures (those with planting plans)
        cultures_with_plans = Culture.objects.filter(
            source='growstuff'
        ).exclude(
            growstuff_id__in=api_ids
        ).filter(
            Exists(has_planting_plans)
        ).prefetch_related('planting_plans')
        
        for culture in cultures_with_plans:
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
