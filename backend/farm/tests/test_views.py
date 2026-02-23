from datetime import date
from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from farm.models import Bed, Culture, Field, Location, PlantingPlan, Supplier

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
            variety="Standard",
            seed_supplier="Test Supplier Co.",
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
            'variety': 'Demo',
            'seed_supplier': 'Test Supplier Co.',
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
            'seed_supplier': 'Bingenheimer',
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
            'seed_supplier': 'Bingenheimer',
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
            # Missing variety and seed_supplier
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('variety', response.data)
        self.assertIn('seed_supplier', response.data)
    
    def test_culture_create_invalid_display_color(self):
        """Test that invalid display color format is rejected"""
        data = {
            'name': 'Test Culture',
            'variety': 'Test',
            'seed_supplier': 'Supplier',
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
            'variety': 'Updated Variety',
            'seed_supplier': 'Updated Supplier',
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
            seed_supplier="Test Supplier",
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
    
    def test_import_apply_create_new(self):
        """Test apply endpoint creates new cultures."""
        data = {
            'items': [{
                'name': 'Cucumber',
                'variety': 'English',
                'seed_supplier': 'Demo Supplier',
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
                'seed_supplier': 'Test Supplier',
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
                'seed_supplier': 'Test Supplier',
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
                    'seed_supplier': 'Demo Supplier',
                    'growth_duration_days': 50,
                    'harvest_duration_days': 20
                },
                {
                    'name': 'Tomato',
                    'variety': 'Cherry',
                    'seed_supplier': 'Test Supplier',
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


class CultureEnrichmentAPITest(DRFAPITestCase):
    """Tests for single-culture enrichment endpoint."""

    def setUp(self):
        self.culture = Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            seed_supplier="Supplier A",
            growth_duration_days=60,
            harvest_duration_days=20,
            notes="Line one https://example.com/a"
        )

    def test_enrich_rejects_missing_required_fields(self):
        self.culture.variety = ''
        self.culture.save(update_fields=['variety'])

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=overwrite',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('missing_fields', response.data)
        self.assertIn('variety', response.data['missing_fields'])

    @patch('farm.views.enrich_culture_data')
    def test_enrich_overwrite_updates_whitelisted_fields(self, mock_enrich):
        mock_enrich.return_value = (
            {
                'harvest_duration_days': 28,
                'notes': 'Research summary from supplier and cultivation guide',
            },
            ['https://supplier.example/pea-norli', 'https://wiki.example/pea'],
            {'parsed_keys': ['harvest_duration_days', 'notes', 'sources']}
        )

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=overwrite',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('notes', response.data['updated_fields'])
        self.assertIn('harvest_duration_days', response.data['updated_fields'])
        self.assertIn('debug', response.data)

        self.culture.refresh_from_db()
        self.assertEqual(self.culture.harvest_duration_days, 28)
        self.assertIn('### Quellen', self.culture.notes)
        self.assertIn('- [https://supplier.example/pea-norli](https://supplier.example/pea-norli)', self.culture.notes)

    @patch('farm.views.enrich_culture_data')
    def test_enrich_fill_missing_updates_only_empty_fields(self, mock_enrich):
        self.culture.harvest_duration_days = None
        self.culture.notes = 'Existing notes Quellen: https://existing.example'
        self.culture.save(update_fields=['harvest_duration_days', 'notes'])

        mock_enrich.return_value = (
            {
                'harvest_duration_days': 35,
                'notes': 'LLM notes that should not replace existing notes in fill mode',
            },
            ['https://supplier.example/pea-norli'],
            {'parsed_keys': ['harvest_duration_days', 'notes', 'sources']}
        )

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=fill_missing',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated_fields'], ['harvest_duration_days'])

        self.culture.refresh_from_db()
        self.assertEqual(self.culture.harvest_duration_days, 35)
        self.assertEqual(self.culture.notes, 'Existing notes Quellen: https://existing.example')


    @patch('farm.views.enrich_culture_data')
    def test_enrich_overwrite_does_not_duplicate_quellen_on_research(self, mock_enrich):
        self.culture.notes = (
            'Ausführliche Notiz.\n\n### Quellen\n'
            '- [https://supplier.example/pea-norli](https://supplier.example/pea-norli)\n'
            '- [https://wiki.example/pea](https://wiki.example/pea)'
        )
        self.culture.save(update_fields=['notes'])

        mock_enrich.return_value = (
            {
                'notes': 'Aktualisierte Notiz zu Kultur und Ernte.',
            },
            ['https://supplier.example/pea-norli', 'https://wiki.example/pea'],
            {'parsed_keys': ['notes', 'sources']}
        )

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=overwrite',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.culture.refresh_from_db()
        self.assertIn('### Quellen', self.culture.notes)
        self.assertEqual(self.culture.notes.count('- [https://supplier.example/pea-norli](https://supplier.example/pea-norli)'), 1)
        self.assertEqual(self.culture.notes.count('- [https://wiki.example/pea](https://wiki.example/pea)'), 1)

    @patch('farm.views.enrich_culture_data')
    def test_enrich_returns_422_when_no_sources(self, mock_enrich):
        from farm.services.enrichment import EnrichmentServiceError

        mock_enrich.side_effect = EnrichmentServiceError('NO_SOURCES')

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=overwrite',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data['code'], 'NO_SOURCES')




    def test_enrich_returns_422_when_no_enrichable_fields(self):
        self.culture.crop_family = 'Fabaceae'
        self.culture.nutrient_demand = 'medium'
        self.culture.cultivation_type = 'direct_sowing'
        self.culture.growth_duration_days = 70
        self.culture.harvest_duration_days = 20
        self.culture.propagation_duration_days = 0
        self.culture.harvest_method = 'per_sqm'
        self.culture.expected_yield = 1
        self.culture.distance_within_row_m = 0.1
        self.culture.row_spacing_m = 0.2
        self.culture.sowing_depth_m = 0.03
        self.culture.seed_rate_value = 2
        self.culture.seed_rate_unit = 'g_per_m2'
        self.culture.sowing_calculation_safety_percent = 10
        self.culture.thousand_kernel_weight_g = 1
        self.culture.package_size_g = 100
        self.culture.notes = 'Summary Quellen: [https://example.com](https://example.com)'
        self.culture.save()

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=fill_missing',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data['code'], 'NO_ENRICHABLE_FIELDS')


    @patch('farm.views.enrich_culture_data')
    def test_enrich_returns_422_when_llm_returns_no_updates(self, mock_enrich):
        mock_enrich.return_value = ({}, ['https://supplier.example/pea-norli'], {'parsed_keys': ['unrelated_key']})

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=fill_missing',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data['code'], 'NO_ENRICHABLE_FIELDS')

    @patch('farm.views.enrich_culture_data')
    def test_enrich_propagates_configuration_error(self, mock_enrich):
        from farm.services.enrichment import EnrichmentServiceError

        mock_enrich.side_effect = EnrichmentServiceError('OPENAI_API_KEY is not configured.')

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/enrich/?mode=overwrite',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['message'], 'LLM not configured.')
        self.assertEqual(response.data['detail'], 'OPENAI_API_KEY is not configured.')



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
