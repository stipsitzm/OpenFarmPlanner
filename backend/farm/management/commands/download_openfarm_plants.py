"""Django management command to download OpenFarm plants.json file.

This command downloads the OpenFarm plant database from GitHub and saves it
to the local data directory for import.
"""

import os
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    """Download OpenFarm plants.json from GitHub repository.
    
    This command downloads the plant database from OpenFarm's GitHub repository
    and saves it to the local data/openfarm/ directory for later import.
    """
    
    help = 'Download OpenFarm plants.json from GitHub repository'
    
    # URL to OpenFarm plants data
    # Note: OpenFarm uses MongoDB, so this URL may need to be adjusted
    # to point to an actual JSON export or API endpoint
    OPENFARM_PLANTS_URL = 'https://raw.githubusercontent.com/openfarmcc/OpenFarm/mainline/db/seeds/plants.json'
    
    def add_arguments(self, parser: Any) -> None:
        """Add command-line arguments.
        
        :param parser: ArgumentParser instance
        """
        parser.add_argument(
            '--url',
            type=str,
            default=self.OPENFARM_PLANTS_URL,
            help='Custom URL to download plants.json from'
        )
        parser.add_argument(
            '--output',
            type=str,
            help='Custom output path (default: data/openfarm/plants.json)'
        )
    
    def handle(self, *args: Any, **options: Any) -> None:
        """Execute the command.
        
        :param args: Positional arguments
        :param options: Command options from add_arguments
        """
        url = options['url']
        
        # Determine output path
        if options['output']:
            output_path = Path(options['output'])
        else:
            # Default to data/openfarm/plants.json relative to project root
            # Find project root by going up from commands/ -> management/ -> farm/ -> backend/ -> project_root
            current_file = Path(__file__)
            backend_dir = current_file.parents[3]
            project_root = backend_dir.parent
            output_path = project_root / 'data' / 'openfarm' / 'plants.json'
        
        # Create directory if it doesn't exist
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        self.stdout.write(f'Downloading OpenFarm plants data from: {url}')
        self.stdout.write(f'Output path: {output_path}')
        
        try:
            # Download the file
            with urllib.request.urlopen(url, timeout=30) as response:
                content = response.read()
                
            # Write to file
            with open(output_path, 'wb') as f:
                f.write(content)
            
            # Get file size for confirmation
            file_size = os.path.getsize(output_path)
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Successfully downloaded {file_size} bytes to {output_path}'
                )
            )
            
        except urllib.error.HTTPError as e:
            raise CommandError(
                f'HTTP Error {e.code}: {e.reason}\n'
                f'Note: OpenFarm uses MongoDB and may not have a plants.json file at this URL.\n'
                f'You may need to use a custom URL or create a local plants.json file.'
            )
        except urllib.error.URLError as e:
            raise CommandError(f'URL Error: {e.reason}')
        except Exception as e:
            raise CommandError(f'Error downloading file: {str(e)}')
