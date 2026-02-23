#!/usr/bin/env python
"""Quick local debug helper for culture enrich endpoint.

Usage:
  python backend/scripts/test_enrich_endpoint.py --culture-id 1 --mode fill_missing
"""

import argparse
import json
import os


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--culture-id', type=int, required=True)
    parser.add_argument('--mode', choices=['overwrite', 'fill_missing'], default='fill_missing')
    args = parser.parse_args()

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

    import django
    django.setup()

    from rest_framework.test import APIClient

    client = APIClient()
    path = f'/openfarmplanner/api/cultures/{args.culture_id}/enrich/?mode={args.mode}'
    response = client.post(path, {}, format='json')

    print(f'POST {path}')
    print(f'Status: {response.status_code}')
    try:
        payload = response.json()
    except Exception:
        payload = {'raw': response.content.decode('utf-8', errors='ignore')}
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
