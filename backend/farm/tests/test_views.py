from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile
from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from farm.models import Bed, Culture, Field, Location, PlantingPlan, Supplier, NoteAttachment

class ApiEndpointsTest(DRFAPITestCase):
    def setUp(self):
        self.location = Location.objects.create(name="API Test Location")
        self.field = Field.objects.create(name="API Test Field", location=self.location)
        self.bed = Bed.objects.create(
            name="API Test Bed", 
            field=self.field,
            area_sqm=20.0  # Total area: 20 sqm
        )
        self.culture = Culture.objects.create(
            name="API Test Culture",
            growth_duration_days=7,
            harvest_duration_days=2
        )
        self.supplier = Supplier.objects.create(name="Test Supplier Co.")

    def test_supplier_list(self):
        """Test listing suppliers"""
        response = self.client.get('/openfarmplanner/api/suppliers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], "Test Supplier Co.")

    def test_supplier_list_with_search(self):
        """Test searching suppliers"""
        Supplier.objects.create(name="Another Supplier")
        response = self.client.get('/openfarmplanner/api/suppliers/?q=Test Supplier')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)
        # At least one result should be "Test Supplier Co."
        supplier_names = [s['name'] for s in response.data['results']]
        self.assertIn("Test Supplier Co.", supplier_names)

    def test_supplier_create_new(self):
        """Test creating a new supplier"""
        data = {'name': 'New Supplier Inc.'}
        response = self.client.post('/openfarmplanner/api/suppliers/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Supplier.objects.count(), 2)
        self.assertEqual(response.data['name'], 'New Supplier Inc.')

    def test_supplier_create_existing(self):
        """Test creating supplier with exact duplicate name returns existing"""
        data = {'name': 'Test Supplier Co.'}
        response = self.client.post('/openfarmplanner/api/suppliers/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(Supplier.objects.count(), 1)
        self.assertEqual(response.data['id'], self.supplier.id)

    def test_supplier_create_normalized_match(self):
        """Test creating supplier with normalized match returns existing"""
        data = {'name': '  TEST SUPPLIER co.  '}
        response = self.client.post('/openfarmplanner/api/suppliers/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(Supplier.objects.count(), 1)
        self.assertEqual(response.data['id'], self.supplier.id)

    def test_culture_with_supplier(self):
        """Test creating culture with supplier"""
        data = {
            'name': 'Culture with Supplier',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'supplier_name': self.supplier.name
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['supplier']['id'], self.supplier.id)

    def test_culture_list(self):
        response = self.client.get('/openfarmplanner/api/cultures/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_culture_create(self):
        data = {
            'name': 'New Culture',
            'variety': 'Test Variety',
            'growth_duration_days': 6,
            'harvest_duration_days': 2
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Culture.objects.count(), 2)
        # Check that display color was auto-generated
        self.assertIn('display_color', response.data)
        self.assertTrue(response.data['display_color'].startswith('#'))
    
    def test_culture_create_with_all_fields(self):
        """Test creating culture with all manual planning fields"""
        data = {
            'name': 'Comprehensive Culture',
            'variety': 'Special Edition',
            'notes': 'Test notes',
            'crop_family': 'Solanaceae',
            'nutrient_demand': 'high',
            'cultivation_type': 'pre_cultivation',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'propagation_duration_days': 4,
            'harvest_method': 'per_plant',
            'expected_yield': 500.0,
            'allow_deviation_delivery_weeks': True,
            'distance_within_row_cm': 40.0,
            'row_spacing_cm': 60.0,
            'sowing_depth_cm': 1.5,
            'thousand_kernel_weight_g': 472.02,
            'package_size_g': 40,
            'display_color': '#FF5733'
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Comprehensive Culture')
        self.assertEqual(response.data['crop_family'], 'Solanaceae')
        self.assertEqual(response.data['nutrient_demand'], 'high')
        self.assertEqual(response.data['thousand_kernel_weight_g'], 472.02)
        self.assertEqual(response.data['package_size_g'], 40.0)
        self.assertEqual(response.data['display_color'], '#FF5733')
    
    def test_culture_create_missing_required_fields(self):
        """Test that creating culture without required fields fails"""
        data = {
            'name': 'Incomplete Culture',
            # Missing growth_duration_days and harvest_duration_days
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('growth_duration_days', response.data)
    
    def test_culture_create_invalid_display_color(self):
        """Test that invalid display color format is rejected"""
        data = {
            'name': 'Test Culture',
            'growth_duration_days': 6,
            'harvest_duration_days': 2,
            'display_color': 'invalid'  # Not hex format
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('display_color', response.data)
    
    def test_culture_update(self):
        """Test updating a culture"""
        data = {
            'name': 'Updated Culture',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'crop_family': 'Updated Family',
            'nutrient_demand': 'medium'
        }
        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Culture')
        self.assertEqual(response.data['crop_family'], 'Updated Family')
    
    def test_bed_list(self):
        response = self.client.get('/openfarmplanner/api/beds/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_planting_plan_create(self):
        data = {
            'culture': self.culture.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'quantity': 50
        }
        response = self.client.post('/openfarmplanner/api/planting-plans/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('harvest_date', response.data)
    
    def test_field_create_with_valid_area(self):
        data = {
            'name': 'Valid Field',
            'location': self.location.id,
            'area_sqm': 500.50
        }
        response = self.client.post('/openfarmplanner/api/fields/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Field.objects.count(), 2)
    
    def test_field_create_with_invalid_area_too_small(self):
        data = {
            'name': 'Too Small Field',
            'location': self.location.id,
            'area_sqm': 0.001
        }
        response = self.client.post('/openfarmplanner/api/fields/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_sqm', response.data)
    
    def test_field_create_with_invalid_area_too_large(self):
        data = {
            'name': 'Too Large Field',
            'location': self.location.id,
            'area_sqm': 2000000  # Greater than MAX_AREA_SQM (1,000,000)
        }
        response = self.client.post('/openfarmplanner/api/fields/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_sqm', response.data)
    
    def test_bed_create_with_valid_area(self):
        data = {
            'name': 'Valid Bed',
            'field': self.field.id,
            'area_sqm': 50.25
        }
        response = self.client.post('/openfarmplanner/api/beds/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Bed.objects.count(), 2)
    
    def test_bed_create_with_invalid_area_too_small(self):
        data = {
            'name': 'Too Small Bed',
            'field': self.field.id,
            'area_sqm': 0.001
        }
        response = self.client.post('/openfarmplanner/api/beds/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_sqm', response.data)
    
    def test_bed_create_with_invalid_area_too_large(self):
        data = {
            'name': 'Too Large Bed',
            'field': self.field.id,
            'area_sqm': 20000
        }
        response = self.client.post('/openfarmplanner/api/beds/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_sqm', response.data)

    def test_planting_plan_area_validation_success(self):
        """Test API allows planting plan within bed capacity"""
        data = {
            'culture': self.culture.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_usage_sqm': 15.0
        }
        response = self.client.post('/openfarmplanner/api/planting-plans/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(response.data['area_usage_sqm']), 15.0)

    def test_planting_plan_area_validation_failure(self):
        """Test API rejects planting plan exceeding bed capacity"""
        data = {
            'culture': self.culture.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_usage_sqm': 25.0  # Exceeds 20 sqm capacity
        }
        response = self.client.post('/openfarmplanner/api/planting-plans/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_planting_plan_area_validation_multiple_plans(self):
        """Test API validates total area of multiple plans"""
        # Create first plan using 12 sqm
        data1 = {
            'culture': self.culture.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_usage_sqm': 12.0
        }
        response1 = self.client.post('/openfarmplanner/api/planting-plans/', data1)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Try to create second plan using 10 sqm (total would be 22 sqm > 20 sqm)
        data2 = {
            'culture': self.culture.id,
            'bed': self.bed.id,
            'planting_date': '2024-04-01',
            'area_usage_sqm': 10.0
        }
        response2 = self.client.post('/openfarmplanner/api/planting-plans/', data2)
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)



class CultureImportAPITest(DRFAPITestCase):
    """Tests for culture import API endpoints."""
    
    def setUp(self):
        """Set up test data."""
        self.supplier = Supplier.objects.create(name="Test Supplier")
        self.existing_culture = Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            supplier=self.supplier,
            growth_duration_days=60,
            harvest_duration_days=30,
            notes="Existing notes"
        )
    
    def test_import_preview_new_culture(self):
        """Test preview endpoint for new culture."""
        data = [{
            'name': 'Cucumber',
            'variety': 'English',
            'growth_duration_days': 50,
            'harvest_duration_days': 20
        }]
        
        response = self.client.post('/openfarmplanner/api/cultures/import/preview/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['status'], 'create')
    
    def test_import_preview_update_candidate(self):
        """Test preview endpoint for matching culture."""
        data = [{
            'name': 'Tomato',
            'variety': 'Cherry',
            'supplier_id': self.supplier.id,
            'growth_duration_days': 65,  # Different value
            'harvest_duration_days': 30,
            'notes': 'Updated notes'  # Different value
        }]
        
        response = self.client.post('/openfarmplanner/api/cultures/import/preview/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
        result = response.data['results'][0]
        self.assertEqual(result['status'], 'update_candidate')
        self.assertEqual(result['matched_culture_id'], self.existing_culture.id)
        self.assertIsInstance(result['diff'], list)
        self.assertGreater(len(result['diff']), 0)
    
    def test_import_preview_supplier_by_name(self):
        """Test preview resolves supplier by name."""
        data = [{
            'name': 'Tomato',
            'variety': 'Cherry',
            'supplier_name': 'test supplier',  # Same normalized name
            'growth_duration_days': 60,
            'harvest_duration_days': 30
        }]
        
        response = self.client.post('/openfarmplanner/api/cultures/import/preview/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        result = response.data['results'][0]
        self.assertEqual(result['status'], 'update_candidate')

    def test_import_preview_supplier_name_matches_seed_supplier_case_insensitive(self):
        """Test preview matches legacy seed_supplier case-insensitively."""
        Culture.objects.create(
            name="Lettuce",
            variety="Batavia",
            seed_supplier="Rainsaat R-Codes",
            growth_duration_days=45,
            harvest_duration_days=20,
        )
        data = [{
            'name': 'Lettuce',
            'variety': 'Batavia',
            'seed_supplier': 'RAINSAAT r-codes',
            'growth_duration_days': 45,
            'harvest_duration_days': 20,
        }]

        response = self.client.post('/openfarmplanner/api/cultures/import/preview/', data, format='json')

        self.assertEqual(response.status_code, 200)
        result = response.data['results'][0]
        self.assertEqual(result['status'], 'update_candidate')

    def test_import_apply_supplier_name_matches_seed_supplier_case_insensitive(self):
        """Test apply updates existing culture when seed_supplier differs only by case."""
        existing = Culture.objects.create(
            name="Carrot",
            variety="Nantes",
            seed_supplier="Rainsaat R-Codes",
            growth_duration_days=70,
            harvest_duration_days=30,
            notes="Before import",
        )
        data = {
            'items': [{
                'name': 'carrot',
                'variety': 'nantes',
                'seed_supplier': 'rainsaat r-codes',
                'growth_duration_days': 70,
                'harvest_duration_days': 30,
                'notes': 'After import',
            }],
            'confirm_updates': True,
        }

        response = self.client.post('/openfarmplanner/api/cultures/import/apply/', data, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created_count'], 0)
        self.assertEqual(response.data['updated_count'], 1)

        existing.refresh_from_db()
        self.assertEqual(existing.notes, 'After import')
    
    def test_import_apply_create_new(self):
        """Test apply endpoint creates new cultures."""
        data = {
            'items': [{
                'name': 'Cucumber',
                'variety': 'English',
                'growth_duration_days': 50,
                'harvest_duration_days': 20
            }],
            'confirm_updates': False
        }
        
        response = self.client.post('/openfarmplanner/api/cultures/import/apply/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created_count'], 1)
        self.assertEqual(response.data['updated_count'], 0)
        self.assertEqual(response.data['skipped_count'], 0)
        
        # Verify culture was created
        self.assertTrue(Culture.objects.filter(name_normalized='cucumber').exists())
    
    def test_import_apply_skip_update_without_confirmation(self):
        """Test apply endpoint skips updates without confirmation."""
        data = {
            'items': [{
                'name': 'Tomato',
                'variety': 'Cherry',
                'supplier_id': self.supplier.id,
                'growth_duration_days': 65,
                'harvest_duration_days': 30,
                'notes': 'Updated notes'
            }],
            'confirm_updates': False
        }
        
        response = self.client.post('/openfarmplanner/api/cultures/import/apply/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created_count'], 0)
        self.assertEqual(response.data['updated_count'], 0)
        self.assertEqual(response.data['skipped_count'], 1)
        
        # Verify culture was not updated
        culture = Culture.objects.get(id=self.existing_culture.id)
        self.assertEqual(culture.growth_duration_days, 60)  # Original value
        self.assertEqual(culture.notes, "Existing notes")  # Original value
    
    def test_import_apply_update_with_confirmation(self):
        """Test apply endpoint updates cultures with confirmation."""
        data = {
            'items': [{
                'name': 'Tomato',
                'variety': 'Cherry',
                'supplier_id': self.supplier.id,
                'growth_duration_days': 65,
                'harvest_duration_days': 30,
                'notes': 'Updated notes'
            }],
            'confirm_updates': True
        }
        
        response = self.client.post('/openfarmplanner/api/cultures/import/apply/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created_count'], 0)
        self.assertEqual(response.data['updated_count'], 1)
        self.assertEqual(response.data['skipped_count'], 0)
        
        # Verify culture was updated
        culture = Culture.objects.get(id=self.existing_culture.id)
        self.assertEqual(culture.growth_duration_days, 65)
        self.assertEqual(culture.notes, "Updated notes")
    
    def test_import_apply_mixed_operations(self):
        """Test apply endpoint with both create and update operations."""
        data = {
            'items': [
                {
                    'name': 'Cucumber',
                    'variety': 'English',
                    'growth_duration_days': 50,
                    'harvest_duration_days': 20
                },
                {
                    'name': 'Tomato',
                    'variety': 'Cherry',
                    'supplier_id': self.supplier.id,
                    'growth_duration_days': 65,
                    'harvest_duration_days': 30
                }
            ],
            'confirm_updates': True
        }
        
        response = self.client.post('/openfarmplanner/api/cultures/import/apply/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created_count'], 1)
        self.assertEqual(response.data['updated_count'], 1)
        self.assertEqual(response.data['skipped_count'], 0)


class PlantingPlanAreaInputTest(DRFAPITestCase):
    """Test area input as m² or plants for PlantingPlan."""
    
    def setUp(self):
        """Create test data."""
        # Create location, field, and bed
        self.location = Location.objects.create(name="Test Farm")
        self.field = Field.objects.create(
            name="Test Field",
            location=self.location,
            area_sqm=100.00
        )
        self.bed = Bed.objects.create(
            name="Test Bed",
            field=self.field,
            area_sqm=10.00
        )
        
        # Create culture with spacing data
        self.culture_with_spacing = Culture.objects.create(
            name="Tomato",
            growth_duration_days=60,
            harvest_duration_days=30,
            row_spacing_m=0.50,  # 50 cm
            distance_within_row_m=0.40  # 40 cm
        )
        
        # Create culture without spacing data
        self.culture_no_spacing = Culture.objects.create(
            name="Cucumber",
            growth_duration_days=50,
            harvest_duration_days=20
        )
    
    def test_plants_per_m2_calculation(self):
        """Test that plants_per_m2 is calculated correctly."""
        # 10000 / (50 * 40) = 10000 / 2000 = 5.0
        expected = 5.0
        self.assertAlmostEqual(float(self.culture_with_spacing.plants_per_m2), expected, places=2)
    
    def test_plants_per_m2_returns_none_when_spacing_missing(self):
        """Test that plants_per_m2 returns None when spacing is missing."""
        self.assertIsNone(self.culture_no_spacing.plants_per_m2)
    
    def test_area_input_m2_creates_planting_plan(self):
        """Test creating planting plan with M2 input."""
        data = {
            'culture': self.culture_with_spacing.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_input_value': '2.50',
            'area_input_unit': 'M2'
        }
        
        response = self.client.post('/openfarmplanner/api/planting-plans/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(response.data['area_usage_sqm']), 2.50)
    
    def test_area_input_plants_converts_correctly(self):
        """Test creating planting plan with PLANTS input converts to m²."""
        # 10 plants / 5 plants_per_m2 = 2.0 m²
        data = {
            'culture': self.culture_with_spacing.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_input_value': '10',
            'area_input_unit': 'PLANTS'
        }
        
        response = self.client.post('/openfarmplanner/api/planting-plans/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # 10 / 5 = 2.0
        self.assertAlmostEqual(float(response.data['area_usage_sqm']), 2.0, places=2)
    
    def test_area_input_plants_fails_when_culture_missing(self):
        """Test that PLANTS input fails when culture is not provided."""
        data = {
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_input_value': '10',
            'area_input_unit': 'PLANTS'
        }
        
        response = self.client.post('/openfarmplanner/api/planting-plans/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('culture', response.data)
    
    def test_area_input_plants_fails_when_spacing_missing(self):
        """Test that PLANTS input fails when culture spacing is missing."""
        data = {
            'culture': self.culture_no_spacing.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_input_value': '10',
            'area_input_unit': 'PLANTS'
        }
        
        response = self.client.post('/openfarmplanner/api/planting-plans/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_input_unit', response.data)
    
    def test_area_input_value_must_be_positive(self):
        """Test that area_input_value must be greater than 0."""
        data = {
            'culture': self.culture_with_spacing.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_input_value': '0',
            'area_input_unit': 'M2'
        }
        
        response = self.client.post('/openfarmplanner/api/planting-plans/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_input_value', response.data)
    
    def test_area_input_unit_required_when_value_provided(self):
        """Test that area_input_unit is required when area_input_value is provided."""
        data = {
            'culture': self.culture_with_spacing.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_input_value': '2.50'
            # Missing area_input_unit
        }
        
        response = self.client.post('/openfarmplanner/api/planting-plans/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_input_unit', response.data)
    
    def test_area_input_plants_update_existing_plan(self):
        """Test updating existing planting plan with PLANTS input."""
        # Create initial plan
        plan = PlantingPlan.objects.create(
            culture=self.culture_with_spacing,
            bed=self.bed,
            planting_date=date(2024, 3, 1),
            area_usage_sqm=1.0
        )
        
        # Update with PLANTS input: 15 plants / 5 plants_per_m2 = 3.0 m²
        data = {
            'culture': self.culture_with_spacing.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'area_input_value': '15',
            'area_input_unit': 'PLANTS'
        }
        
        response = self.client.put(f'/openfarmplanner/api/planting-plans/{plan.id}/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertAlmostEqual(float(response.data['area_usage_sqm']), 3.0, places=2)


class NoteAttachmentApiTest(DRFAPITestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Attachment Location")
        self.field = Field.objects.create(name="Attachment Field", location=self.location)
        self.bed = Bed.objects.create(name="Attachment Bed", field=self.field)
        self.culture = Culture.objects.create(name="Attachment Culture", growth_duration_days=7, harvest_duration_days=2)
        self.plan = PlantingPlan.objects.create(culture=self.culture, bed=self.bed, planting_date=date(2024, 3, 1))

    @patch('farm.views.process_note_image')
    def test_upload_list_delete_attachment(self, mock_process):
        mock_process.return_value = (
            SimpleUploadedFile('processed.webp', b'processed', content_type='image/webp'),
            {
                'width': 1280,
                'height': 720,
                'size_bytes': 9,
                'mime_type': 'image/webp',
            },
        )
        upload = SimpleUploadedFile('raw.jpg', b'raw', content_type='image/jpeg')

        upload_response = self.client.post(
            f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
            {'image': upload},
            format='multipart',
        )
        self.assertEqual(upload_response.status_code, status.HTTP_201_CREATED)
        self.assertLessEqual(upload_response.data['width'], 1280)

        list_response = self.client.get(f'/openfarmplanner/api/notes/{self.plan.id}/attachments/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        attachment_id = upload_response.data['id']
        delete_response = self.client.delete(f'/openfarmplanner/api/attachments/{attachment_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)


    @patch(
        'farm.views.process_note_image',
        side_effect=__import__('farm.image_processing', fromlist=['ImageProcessingBackendUnavailableError']).ImageProcessingBackendUnavailableError('Image processing backend is not available. Install Pillow in the backend environment.'),
    )
    def test_attachment_upload_returns_503_when_processing_backend_missing(self, _mock_process):
        upload = SimpleUploadedFile('raw.jpg', b'raw', content_type='image/jpeg')
        response = self.client.post(
            f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
            {'image': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch(
        'farm.views.process_note_image',
        side_effect=__import__('farm.image_processing', fromlist=['ImageProcessingError']).ImageProcessingError('bad image'),
    )
    def test_invalid_attachment_upload_returns_400(self, _mock_process):
        upload = SimpleUploadedFile('not-image.txt', b'text', content_type='text/plain')
        response = self.client.post(
            f'/openfarmplanner/api/notes/{self.plan.id}/attachments/',
            {'image': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PlantingPlanAttachmentCountApiTest(DRFAPITestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Plan Location")
        self.field = Field.objects.create(name="Plan Field", location=self.location)
        self.bed = Bed.objects.create(name="Plan Bed", field=self.field)
        self.culture = Culture.objects.create(name="Plan Culture", growth_duration_days=7, harvest_duration_days=2)

        self.plan_without_attachments = PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, planting_date=date(2024, 3, 1), notes='No attachments'
        )
        self.plan_with_attachments = PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, planting_date=date(2024, 3, 2), notes='With attachments'
        )

        NoteAttachment.objects.create(
            planting_plan=self.plan_with_attachments,
            image='notes/test-1.webp',
            mime_type='image/webp',
            width=100,
            height=100,
            size_bytes=1000,
        )
        NoteAttachment.objects.create(
            planting_plan=self.plan_with_attachments,
            image='notes/test-2.webp',
            mime_type='image/webp',
            width=100,
            height=100,
            size_bytes=1000,
        )

    def test_planting_plan_list_contains_attachment_count(self):
        response = self.client.get('/openfarmplanner/api/planting-plans/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        by_id = {item['id']: item for item in response.data['results']}
        self.assertEqual(by_id[self.plan_without_attachments.id]['note_attachment_count'], 0)
        self.assertEqual(by_id[self.plan_with_attachments.id]['note_attachment_count'], 2)

    def test_planting_plan_list_query_count_stays_stable(self):
        with self.assertNumQueries(2):
            response = self.client.get('/openfarmplanner/api/planting-plans/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)


class PlantingPlanRemainingAreaApiTest(DRFAPITestCase):
    """Tests for remaining-area endpoint on planting plans."""

    def setUp(self):
        self.location = Location.objects.create(name='Remaining Location')
        self.field = Field.objects.create(name='Remaining Field', location=self.location)
        self.bed = Bed.objects.create(name='Remaining Bed', field=self.field, area_sqm=20)
        self.other_bed = Bed.objects.create(name='Other Bed', field=self.field, area_sqm=15)
        self.culture = Culture.objects.create(
            name='Lettuce',
            growth_duration_days=30,
            harvest_duration_days=10,
        )

        self.plan_one = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=date(2024, 3, 1),
            area_usage_sqm=6,
        )
        self.plan_two = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=date(2024, 3, 15),
            area_usage_sqm=4,
        )
        PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.other_bed,
            planting_date=date(2024, 3, 10),
            area_usage_sqm=8,
        )

    def test_remaining_area_returns_overlap_sum(self):
        response = self.client.get(
            '/openfarmplanner/api/planting-plans/remaining-area/',
            {
                'bed_id': self.bed.id,
                'start_date': '2024-03-20',
                'end_date': '2024-04-10',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['bed_id'], self.bed.id)
        self.assertEqual(response.data['bed_area_sqm'], 20.0)
        self.assertEqual(response.data['overlapping_used_area_sqm'], 10.0)
        self.assertEqual(response.data['remaining_area_sqm'], 10.0)

    def test_remaining_area_excludes_current_plan(self):
        response = self.client.get(
            '/openfarmplanner/api/planting-plans/remaining-area/',
            {
                'bed_id': self.bed.id,
                'start_date': '2024-03-20',
                'end_date': '2024-04-10',
                'exclude_plan_id': self.plan_two.id,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['overlapping_used_area_sqm'], 6.0)
        self.assertEqual(response.data['remaining_area_sqm'], 14.0)

    def test_remaining_area_validates_required_params(self):
        response = self.client.get('/openfarmplanner/api/planting-plans/remaining-area/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_remaining_area_rejects_invalid_date_range(self):
        response = self.client.get(
            '/openfarmplanner/api/planting-plans/remaining-area/',
            {
                'bed_id': self.bed.id,
                'start_date': '2024-04-10',
                'end_date': '2024-03-20',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_remaining_area_rejects_invalid_bed_id_type(self):
        response = self.client.get(
            '/openfarmplanner/api/planting-plans/remaining-area/',
            {
                'bed_id': 'abc',
                'start_date': '2024-03-20',
                'end_date': '2024-04-10',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
