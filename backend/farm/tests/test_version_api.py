import re

from django.test import TestCase
from rest_framework.test import APIClient

from config.version import get_version


class VersionAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_version_endpoint_returns_current_version(self):
        response = self.client.get('/openfarmplanner/api/version/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'version': get_version()})

    def test_version_matches_semver_format(self):
        semver_pattern = re.compile(r'^\d+\.\d+\.\d+$')

        response = self.client.get('/openfarmplanner/api/version/')
        self.assertEqual(response.status_code, 200)

        version_value = response.json()['version']
        self.assertRegex(version_value, semver_pattern)

    def test_version_helper_returns_semver(self):
        semver_pattern = re.compile(r'^\d+\.\d+\.\d+$')
        self.assertRegex(get_version(), semver_pattern)
