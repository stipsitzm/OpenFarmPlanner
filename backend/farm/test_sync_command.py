"""
Tests for the sync_growstuff_crops management command.

This module tests the crop synchronization logic including
creating, updating, and deleting crops.
"""

from unittest.mock import Mock, patch, MagicMock
from io import StringIO
from datetime import datetime, timezone, date

from django.test import TestCase
from django.core.management import call_command
from django.utils import timezone as django_timezone

from farm.models import Culture, Location, Field, Bed, PlantingPlan
from farm.management.commands.sync_growstuff_crops import Command


class SyncGrowstuffCropsCommandTest(TestCase):
    """Test cases for the sync_growstuff_crops management command."""
    
    def setUp(self) -> None:
        """Set up test fixtures."""
        self.command = Command()
        self.command.stdout = StringIO()
    
    def test_extract_days_to_harvest_direct_field(self) -> None:
        """Test extracting days_to_harvest from direct field."""
        attributes = {'median_days_to_first_harvest': 60}
        result = self.command._extract_days_to_harvest(attributes)
        self.assertEqual(result, 60)
    
    def test_extract_days_to_harvest_alternative_fields(self) -> None:
        """Test extracting from alternative field names."""
        attributes = {'median_days_to_last_harvest': 45}
        result = self.command._extract_days_to_harvest(attributes)
        self.assertEqual(result, 45)
    
    def test_extract_days_to_harvest_string_value(self) -> None:
        """Test extracting from string value."""
        attributes = {'days_to_harvest': '70'}
        result = self.command._extract_days_to_harvest(attributes)
        self.assertEqual(result, 70)
    
    def test_extract_days_to_harvest_missing(self) -> None:
        """Test behavior when days_to_harvest is missing."""
        attributes = {}
        result = self.command._extract_days_to_harvest(attributes)
        self.assertEqual(result, 0)
    
    def test_upsert_crop_create_new(self) -> None:
        """Test creating a new crop from Growstuff data."""
        # JSON:API format
        crop_data = {
            'id': '123',
            'type': 'crops',
            'attributes': {
                'name': 'Tomato',
                'median_days_to_first_harvest': 60
            }
        }
        
        result = self.command._upsert_crop(crop_data)
        
        self.assertEqual(result, 'created')
        
        # Verify crop was created
        culture = Culture.objects.get(growstuff_id=123)
        self.assertEqual(culture.name, 'Tomato')
        self.assertEqual(culture.days_to_harvest, 60)
        self.assertEqual(culture.source, 'growstuff')
        self.assertIsNotNone(culture.last_synced)
        self.assertIn('Growstuff.org', culture.notes)
        self.assertIn('CC-BY-SA', culture.notes)
    
    def test_upsert_crop_update_existing(self) -> None:
        """Test updating an existing crop from Growstuff."""
        # Create existing crop
        culture = Culture.objects.create(
            name='Old Name',
            growstuff_id=123,
            growstuff_slug='old-slug',
            source='growstuff',
            days_to_harvest=50
        )
        
        # JSON:API format
        crop_data = {
            'id': '123',
            'type': 'crops',
            'attributes': {
                'name': 'New Name',
                'median_days_to_first_harvest': 70
            }
        }
        
        result = self.command._upsert_crop(crop_data)
        
        self.assertEqual(result, 'updated')
        
        # Verify crop was updated
        culture.refresh_from_db()
        self.assertEqual(culture.name, 'New Name')
        self.assertEqual(culture.days_to_harvest, 70)
        self.assertIsNotNone(culture.last_synced)
    
    def test_upsert_crop_skip_manual(self) -> None:
        """Test that manual entries are not overwritten."""
        # Create manual entry with same Growstuff ID
        culture = Culture.objects.create(
            name='Manual Entry',
            growstuff_id=123,
            source='manual',
            days_to_harvest=50
        )
        
        # JSON:API format
        crop_data = {
            'id': '123',
            'type': 'crops',
            'attributes': {
                'name': 'API Name',
                'median_days_to_first_harvest': 70
            }
        }
        
        result = self.command._upsert_crop(crop_data)
        
        self.assertEqual(result, 'skipped')
        
        # Verify crop was NOT updated
        culture.refresh_from_db()
        self.assertEqual(culture.name, 'Manual Entry')
        self.assertEqual(culture.source, 'manual')
    
    def test_upsert_crop_missing_required_fields(self) -> None:
        """Test handling of crop data with missing required fields."""
        crop_data = {'id': '123'}  # Missing attributes
        result = self.command._upsert_crop(crop_data)
        self.assertEqual(result, 'skipped')
        
        crop_data = {'attributes': {'name': 'Tomato'}}  # Missing id
        result = self.command._upsert_crop(crop_data)
        self.assertEqual(result, 'skipped')
    
    def test_upsert_crop_default_days_to_harvest(self) -> None:
        """Test that default value is used when days_to_harvest is missing."""
        # JSON:API format without harvest days
        crop_data = {
            'id': '456',
            'type': 'crops',
            'attributes': {
                'name': 'Unknown Crop'
            }
        }
        
        result = self.command._upsert_crop(crop_data)
        
        self.assertEqual(result, 'created')
        culture = Culture.objects.get(growstuff_id=456)
        self.assertEqual(culture.days_to_harvest, 60)  # Default value
    
    def test_sync_crops(self) -> None:
        """Test syncing multiple crops."""
        # JSON:API format
        crops_data = [
            {'id': '1', 'type': 'crops', 'attributes': {'name': 'Tomato', 'median_days_to_first_harvest': 60}},
            {'id': '2', 'type': 'crops', 'attributes': {'name': 'Lettuce', 'median_days_to_first_harvest': 30}},
            {'id': '3', 'type': 'crops', 'attributes': {'name': 'Carrot', 'median_days_to_first_harvest': 70}},
        ]
        
        stats = self.command._sync_crops(crops_data)
        
        self.assertEqual(stats['created'], 3)
        self.assertEqual(stats['updated'], 0)
        self.assertEqual(stats['skipped'], 0)
        self.assertEqual(stats['total'], 3)
        self.assertEqual(Culture.objects.count(), 3)
    
    def test_delete_unused_crops(self) -> None:
        """Test deleting crops no longer in API and not used."""
        # Create crops from Growstuff
        crop1 = Culture.objects.create(
            name='Keep Me',
            growstuff_id=1,
            source='growstuff',
            days_to_harvest=60
        )
        
        crop2 = Culture.objects.create(
            name='Delete Me',
            growstuff_id=2,
            source='growstuff',
            days_to_harvest=60
        )
        
        crop3 = Culture.objects.create(
            name='In Use',
            growstuff_id=3,
            source='growstuff',
            days_to_harvest=60
        )
        
        # Create a planting plan using crop3
        location = Location.objects.create(name='Test Location')
        field = Field.objects.create(name='Test Field', location=location)
        bed = Bed.objects.create(name='Test Bed', field=field)
        PlantingPlan.objects.create(
            culture=crop3,
            bed=bed,
            planting_date=date(2024, 1, 1)
        )
        
        # API only has crop 1 and 3 (JSON:API format)
        api_crops = [
            {'id': '1', 'attributes': {'name': 'Keep Me'}},
            {'id': '3', 'attributes': {'name': 'In Use'}}
        ]
        
        deleted = self.command._delete_unused_crops(api_crops)
        
        # Should delete only crop2
        self.assertEqual(deleted, 1)
        self.assertTrue(Culture.objects.filter(growstuff_id=1).exists())
        self.assertFalse(Culture.objects.filter(growstuff_id=2).exists())
        self.assertTrue(Culture.objects.filter(growstuff_id=3).exists())
    
    def test_delete_unused_crops_keeps_manual(self) -> None:
        """Test that manual crops are never deleted."""
        # Create manual crop
        Culture.objects.create(
            name='Manual Crop',
            growstuff_id=999,
            source='manual',
            days_to_harvest=60
        )
        
        # Empty API response
        api_crops = []
        
        deleted = self.command._delete_unused_crops(api_crops)
        
        # Manual crop should not be deleted
        self.assertEqual(deleted, 0)
        self.assertTrue(Culture.objects.filter(growstuff_id=999).exists())
    
    @patch('farm.management.commands.sync_growstuff_crops.GrowstuffClient')
    def test_command_execution(self, mock_client_class: Mock) -> None:
        """Test full command execution."""
        # Mock the API client - JSON:API format
        mock_client = MagicMock()
        mock_client.get_all_crops.return_value = [
            {'id': '1', 'type': 'crops', 'attributes': {'name': 'Tomato', 'median_days_to_first_harvest': 60}},
            {'id': '2', 'type': 'crops', 'attributes': {'name': 'Lettuce', 'median_days_to_first_harvest': 30}},
        ]
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        # Run command
        out = StringIO()
        call_command('sync_growstuff_crops', stdout=out)
        
        # Verify crops were created
        self.assertEqual(Culture.objects.count(), 2)
        self.assertTrue(Culture.objects.filter(name='Tomato').exists())
        self.assertTrue(Culture.objects.filter(name='Lettuce').exists())
        
        # Verify output
        output = out.getvalue()
        self.assertIn('Created: 2', output)
        self.assertIn('CC-BY-SA', output)
        self.assertIn('Attribution', output)
    
    @patch('farm.management.commands.sync_growstuff_crops.GrowstuffClient')
    def test_command_with_limit(self, mock_client_class: Mock) -> None:
        """Test command execution with limit option."""
        # Mock the API client - JSON:API format
        mock_client = MagicMock()
        mock_client.get_all_crops.return_value = [
            {'id': str(i), 'type': 'crops', 'attributes': {'name': f'Crop {i}', 'median_days_to_first_harvest': 60}}
            for i in range(1, 11)
        ]
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        # Run command with limit
        out = StringIO()
        call_command('sync_growstuff_crops', limit=5, stdout=out)
        
        # Should only create 5 crops
        self.assertEqual(Culture.objects.count(), 5)
        
        output = out.getvalue()
        self.assertIn('Limited to first 5 crops', output)
    
    @patch('farm.management.commands.sync_growstuff_crops.GrowstuffClient')
    def test_command_with_delete_unused(self, mock_client_class: Mock) -> None:
        """Test command execution with delete-unused option."""
        # Create an existing crop that will be deleted
        Culture.objects.create(
            name='Old Crop',
            growstuff_id=999,
            source='growstuff',
            days_to_harvest=60
        )
        
        # Mock the API client (doesn't include the old crop) - JSON:API format
        mock_client = MagicMock()
        mock_client.get_all_crops.return_value = [
            {'id': '1', 'type': 'crops', 'attributes': {'name': 'New Crop', 'median_days_to_first_harvest': 60}}
        ]
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        # Run command with delete-unused
        out = StringIO()
        call_command('sync_growstuff_crops', delete_unused=True, stdout=out)
        
        # Old crop should be deleted
        self.assertFalse(Culture.objects.filter(growstuff_id=999).exists())
        self.assertTrue(Culture.objects.filter(growstuff_id=1).exists())
        
        output = out.getvalue()
        self.assertIn('Deleted: 1', output)
