#!/usr/bin/env python3
"""
Standalone script to download OpenFarm plant data.

This script can be run independently of Django to download plants.json
from a URL and save it to the data directory.

Usage:
    python scripts/download_openfarm_plants.py [URL] [OUTPUT_PATH]

Examples:
    python scripts/download_openfarm_plants.py
    python scripts/download_openfarm_plants.py https://example.com/plants.json
    python scripts/download_openfarm_plants.py https://example.com/plants.json /tmp/plants.json
"""

import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


def download_openfarm_plants(url: str, output_path: Path) -> None:
    """Download OpenFarm plants.json from a URL.
    
    :param url: URL to download from
    :param output_path: Path where the file should be saved
    """
    # Create directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f'Downloading OpenFarm plants data from: {url}')
    print(f'Output path: {output_path}')
    
    try:
        # Download the file
        with urllib.request.urlopen(url, timeout=30) as response:
            content = response.read()
        
        # Write to file
        with open(output_path, 'wb') as f:
            f.write(content)
        
        # Get file size for confirmation
        file_size = os.path.getsize(output_path)
        
        print(f'✓ Successfully downloaded {file_size} bytes to {output_path}')
        
    except urllib.error.HTTPError as e:
        print(f'❌ HTTP Error {e.code}: {e.reason}', file=sys.stderr)
        print('Note: OpenFarm uses MongoDB and may not have a plants.json file at this URL.', file=sys.stderr)
        print('You may need to use a custom URL or create a local plants.json file.', file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f'❌ URL Error: {e.reason}', file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f'❌ Error downloading file: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    # Default URL (note: this may not exist as OpenFarm uses MongoDB)
    DEFAULT_URL = 'https://raw.githubusercontent.com/openfarmcc/OpenFarm/mainline/db/seeds/plants.json'
    
    # Determine script location and project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    default_output = project_root / 'data' / 'openfarm' / 'plants.json'
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = DEFAULT_URL
    
    if len(sys.argv) > 2:
        output_path = Path(sys.argv[2])
    else:
        output_path = default_output
    
    # Run download
    download_openfarm_plants(url, output_path)
