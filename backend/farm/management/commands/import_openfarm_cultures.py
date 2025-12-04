"""Django management command to import OpenFarm plant data into Culture model.

This command reads OpenFarm plants.json and imports/updates Culture records
with validation, logging, and dry-run support.
"""

import json
from pathlib import Path
from typing import Any, Dict, List

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from farm.models import Culture
from farm.openfarm_import import (
    map_openfarm_plant_to_culture,
    get_upsert_key,
    SkipPlant,
    extract_maturity_days,
)


class Command(BaseCommand):
    """Import OpenFarm plant data into TinyFarm Culture model.
    
    This command reads plants.json from the data/openfarm directory,
    maps the plant data to Culture model fields, and upserts records
    into the database.
    """
    
    help = 'Import OpenFarm plant data into Culture model'
    
    def add_arguments(self, parser: Any) -> None:
        """Add command-line arguments.
        
        :param parser: ArgumentParser instance
        """
        parser.add_argument(
            '--file',
            type=str,
            help='Path to plants.json file (default: data/openfarm/plants.json)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Parse and validate without writing to database'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output for each plant'
        )
    
    def handle(self, *args: Any, **options: Any) -> None:
        """Execute the import command.
        
        :param args: Positional arguments
        :param options: Command options from add_arguments
        """
        # Determine input file path
        if options['file']:
            file_path = Path(options['file'])
        else:
            # Default to data/openfarm/plants.json relative to project root
            current_file = Path(__file__)
            project_root = current_file.parent.parent.parent.parent.parent
            file_path = project_root / 'data' / 'openfarm' / 'plants.json'
        
        if not file_path.exists():
            raise CommandError(f'File not found: {file_path}')
        
        dry_run = options['dry_run']
        verbose = options['verbose']
        
        self.stdout.write(f'Reading plants data from: {file_path}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        
        # Read and parse JSON file
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                plants_data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f'Invalid JSON in {file_path}: {e}')
        except Exception as e:
            raise CommandError(f'Error reading file: {e}')
        
        if not isinstance(plants_data, list):
            raise CommandError('plants.json must contain an array of plant objects')
        
        self.stdout.write(f'Found {len(plants_data)} plants to process')
        
        # Process plants
        stats = {
            'processed': 0,
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0,
        }
        skipped_reasons: Dict[str, int] = {}
        
        for plant_data in plants_data:
            stats['processed'] += 1
            
            try:
                # Map OpenFarm data to Culture fields
                culture_data = map_openfarm_plant_to_culture(plant_data)
                
                # Extract maturity days if available
                maturity_days = extract_maturity_days(plant_data)
                if maturity_days:
                    culture_data['maturity_days'] = maturity_days
                    # Also set days_to_harvest for backward compatibility
                    if not culture_data.get('days_to_harvest'):
                        culture_data['days_to_harvest'] = maturity_days
                
                # Get upsert key
                lookup_key = get_upsert_key(culture_data)
                
                if verbose:
                    self.stdout.write(f"  Processing: {culture_data['name']}", ending='')
                    if culture_data.get('variety'):
                        self.stdout.write(f" ({culture_data['variety']})", ending='')
                
                # Perform upsert
                if not dry_run:
                    with transaction.atomic():
                        culture, created = Culture.objects.update_or_create(
                            **lookup_key,
                            defaults=culture_data
                        )
                    
                    if created:
                        stats['created'] += 1
                        if verbose:
                            self.stdout.write(self.style.SUCCESS(' ✓ Created'))
                    else:
                        stats['updated'] += 1
                        if verbose:
                            self.stdout.write(self.style.SUCCESS(' ✓ Updated'))
                else:
                    # Dry run - just validate
                    if verbose:
                        self.stdout.write(' (would upsert)')
                
            except SkipPlant as e:
                stats['skipped'] += 1
                reason = str(e.reason)
                skipped_reasons[reason] = skipped_reasons.get(reason, 0) + 1
                
                if verbose:
                    self.stdout.write(
                        self.style.WARNING(f"  Skipped: {reason}")
                    )
            
            except Exception as e:
                stats['errors'] += 1
                self.stdout.write(
                    self.style.ERROR(
                        f"  Error processing plant {plant_data.get('name', 'unknown')}: {e}"
                    )
                )
        
        # Print summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Import Summary:'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'Total processed: {stats["processed"]}')
        
        if not dry_run:
            self.stdout.write(self.style.SUCCESS(f'  Created: {stats["created"]}'))
            self.stdout.write(self.style.SUCCESS(f'  Updated: {stats["updated"]}'))
        
        if stats['skipped'] > 0:
            self.stdout.write(self.style.WARNING(f'  Skipped: {stats["skipped"]}'))
            if skipped_reasons:
                self.stdout.write('  Reasons:')
                for reason, count in skipped_reasons.items():
                    self.stdout.write(f'    - {reason}: {count}')
        
        if stats['errors'] > 0:
            self.stdout.write(self.style.ERROR(f'  Errors: {stats["errors"]}'))
        
        if dry_run:
            self.stdout.write('')
            self.stdout.write(
                self.style.WARNING(
                    'DRY RUN completed - no changes were saved to database'
                )
            )
