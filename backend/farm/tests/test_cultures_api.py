"""API tests for cultures, supplier data, and seed demand."""

from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from accounts.models import DocumentConsent
from farm.models import (
    Culture,
    CultureSupplierData,
    PlantingPlan,
    Project,
    ProjectMembership,
    PublicCulture,
    SeedPackage,
    Supplier,
)
from farm.tests.api_base import ProjectApiTestCase, User


class CultureApiTest(ProjectApiTestCase):
    def test_culture_with_supplier(self):
        """Test creating culture with supplier"""
        data = {
            'name': 'Culture with Supplier',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'harvest_method': 'per_plant',
            'supplier_name': self.supplier.name,
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['supplier']['id'], self.supplier.id)

    def test_culture_list(self):
        response = self.client.get('/openfarmplanner/api/cultures/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_culture_list_query_count_does_not_scale_with_result_count(self):
        # Regression test: get_queryset() previously dropped the select_related/
        # prefetch_related applied on the class-level `queryset`, causing one extra
        # query per culture for `supplier`, `image_file`, `source_public_culture`,
        # `seed_packages`, and the owned-public-culture lookup.
        for index in range(5):
            Culture.objects.create(
                name=f'Extra Culture {index}',
                growth_duration_days=7,
                harvest_duration_days=2,
                project=self.project,
                supplier=self.supplier,
            )

        with self.assertNumQueries(8):
            response = self.client.get('/openfarmplanner/api/cultures/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 6)

    def test_culture_detail_returns_all_supplier_data_rows(self):
        supplier_a = Supplier.objects.create(name='Supplier A', homepage_url='https://supplier-a.example', project=self.project)
        supplier_b = Supplier.objects.create(name='Supplier B', homepage_url='https://supplier-b.example', project=self.project)
        CultureSupplierData.objects.create(
            culture=self.culture,
            supplier=supplier_a,
            project=self.project,
            supplier_product_name='Alpha Product',
            packaging_sizes=[{'size_value': 5, 'size_unit': 'g'}],
        )
        CultureSupplierData.objects.create(
            culture=self.culture,
            supplier=supplier_b,
            project=self.project,
            supplier_product_name='Beta Product',
            packaging_sizes=[{'size_value': 10, 'size_unit': 'g'}],
        )

        response = self.client.get(f'/openfarmplanner/api/cultures/{self.culture.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['supplier_data']), 2)
        supplier_names = {entry['supplier']['name'] for entry in response.data['supplier_data']}
        self.assertEqual(supplier_names, {'Supplier A', 'Supplier B'})

    def test_culture_create(self):
        data = {
            'name': 'New Culture',
            'variety': 'Test Variety',
            'growth_duration_days': 6,
            'harvest_duration_days': 2,
            'harvest_method': 'per_plant',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Culture.objects.count(), 2)
        # Check that display color was auto-generated
        self.assertIn('display_color', response.data)
        self.assertTrue(response.data['display_color'].startswith('#'))

    def test_culture_create_allows_same_name_with_different_variety(self):
        data = {
            'name': self.culture.name,
            'variety': 'Different Variety',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_culture_create_rejects_duplicate_name_and_variety(self):
        existing = Culture.objects.create(
            name='Duplicate Test Culture',
            variety='Nantaise',
            project=self.project,
        )
        data = {
            'name': existing.name,
            'variety': existing.variety,
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_culture_create_rejects_duplicate_name_and_variety_case_and_whitespace_insensitive(self):
        existing = Culture.objects.create(
            name='Duplicate Whitespace Culture',
            variety='Nantaise',
            project=self.project,
        )
        data = {
            'name': f"  {existing.name.upper()}  ",
            'variety': f"  {existing.variety.upper()}  ",
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_culture_duplicate_check_is_project_scoped_and_excludes_public_cultures(self):
        Culture.objects.create(name='Tomate', variety='Roma', project=self.project)
        other_project = Project.objects.create(name='Other Project', slug='other-project')
        Culture.objects.create(name='Paprika', variety='Sweet', project=other_project)
        PublicCulture.objects.create(name='Bohne', variety='Neckargold', status='published')

        matching_response = self.client.get(
            '/openfarmplanner/api/cultures/duplicate-check/',
            {'name': ' tomate ', 'variety': 'ROMA'},
        )
        other_project_response = self.client.get(
            '/openfarmplanner/api/cultures/duplicate-check/',
            {'name': 'Paprika', 'variety': 'Sweet'},
        )
        public_response = self.client.get(
            '/openfarmplanner/api/cultures/duplicate-check/',
            {'name': 'Bohne', 'variety': 'Neckargold'},
        )

        self.assertEqual(matching_response.status_code, status.HTTP_200_OK)
        self.assertTrue(matching_response.data['exists'])
        self.assertFalse(other_project_response.data['exists'])
        self.assertFalse(public_response.data['exists'])

    def test_public_culture_match_returns_exact_normalized_match(self):
        PublicCulture.objects.create(name='Tomate', variety='Roma', status='published')

        response = self.client.get(
            '/openfarmplanner/api/public-cultures/match/',
            {'name': ' tomate ', 'variety': 'ROMA'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['exists'])
        self.assertEqual(response.data['culture']['name'], 'Tomate')

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
            'display_color': '#FF5733',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Comprehensive Culture')
        self.assertEqual(response.data['crop_family'], 'Solanaceae')
        self.assertEqual(response.data['nutrient_demand'], 'high')
        self.assertEqual(response.data['thousand_kernel_weight_g'], 472.02)
        self.assertEqual(response.data['display_color'], '#FF5733')

    def test_culture_create_without_durations(self):
        """Test that creating culture without durations is allowed"""
        data = {
            'name': 'Culture Without Durations',
            'variety': 'Optional Timing',
            'supplier_name': self.supplier.name,
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['growth_duration_days'])
        self.assertIsNone(response.data['harvest_duration_days'])

    def test_culture_create_invalid_display_color(self):
        """Test that invalid display color format is rejected"""
        data = {
            'name': 'Test Culture',
            'growth_duration_days': 6,
            'harvest_duration_days': 2,
            'harvest_method': 'per_plant',
            'display_color': 'invalid',  # Not hex format
            'project': self.project.id,
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
            'harvest_method': 'per_plant',
            'crop_family': 'Updated Family',
            'nutrient_demand': 'medium',
            'project': self.project.id,
        }
        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Culture')
        self.assertEqual(response.data['crop_family'], 'Updated Family')

    def test_culture_update_persists_thousand_kernel_weight_on_culture(self):
        data = {
            'name': self.culture.name,
            'variety': self.culture.variety,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'harvest_method': self.culture.harvest_method,
            'thousand_kernel_weight_g': 4.2,
            'project': self.project.id,
        }
        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['thousand_kernel_weight_g'], 4.2)
        self.culture.refresh_from_db()
        self.assertEqual(float(self.culture.thousand_kernel_weight_g), 4.2)

    def test_culture_partial_update_persists_thousand_kernel_weight_on_culture(self):
        response = self.client.patch(
            f'/openfarmplanner/api/cultures/{self.culture.id}/',
            {'thousand_kernel_weight_g': 3.8},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['thousand_kernel_weight_g'], 3.8)
        self.culture.refresh_from_db()
        self.assertEqual(float(self.culture.thousand_kernel_weight_g), 3.8)

    def test_culture_update_with_seed_packages_payload_from_get(self):
        """PUT with seed package objects (including id/culture) should stay valid."""
        supplier = Supplier.objects.create(name='Seed Supplier', homepage_url='https://seed-supplier.example', project=self.project)
        culture = Culture.objects.create(
            name='Payload Culture',
            variety='Classic',
            supplier=supplier,
            growth_duration_days=10,
            harvest_duration_days=2,
            harvest_method='per_plant',
            project=self.project,
        )
        package = SeedPackage.objects.create(culture=culture, size_value='25.0', size_unit='g', project=self.project)

        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'supplier_id': supplier.id,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'seed_packages': [
                {
                    'id': package.id,
                    'culture': culture.id,
                    'size_value': 25.0,
                    'size_unit': 'g',
                                    }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['seed_packages']), 1)
        self.assertEqual(response.data['seed_packages'][0]['size_unit'], 'g')
        self.assertEqual(float(response.data['seed_packages'][0]['size_value']), 25.0)
        self.assertEqual(SeedPackage.objects.get(culture=culture).project, self.project)

    def test_culture_update_creates_supplier_data_without_culture_in_payload(self):
        """Nested supplier rows should inherit the parent culture automatically."""
        supplier = Supplier.objects.create(name='Nested Supplier', homepage_url='https://nested-supplier.example', project=self.project)
        culture = Culture.objects.create(
            name='Nested Culture',
            variety='Create',
            growth_duration_days=10,
            harvest_duration_days=3,
            harvest_method='per_plant',
            project=self.project,
        )
        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'supplier_id': supplier.id,
                    'supplier_product_name': 'Nested product',
                    'packaging_sizes': [{'size_value': 50, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['supplier_data']), 1)
        row = CultureSupplierData.objects.get(culture=culture, supplier=supplier)
        self.assertEqual(row.supplier_product_name, 'Nested product')
        self.assertEqual(row.project_id, self.project.id)

    def test_culture_update_updates_existing_supplier_data_rows(self):
        """Rows with ids should update in place instead of being recreated."""
        supplier = Supplier.objects.create(name='Update Supplier', homepage_url='https://update-supplier.example', project=self.project)
        culture = Culture.objects.create(
            name='Nested Update',
            variety='Update',
            growth_duration_days=10,
            harvest_duration_days=3,
            harvest_method='per_plant',
            project=self.project,
        )
        existing = CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier,
            project=self.project,
            supplier_product_name='Before',
        )
        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'id': existing.id,
                    'supplier_id': supplier.id,
                    'supplier_product_name': 'After',
                    'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=culture).count(), 1)
        existing.refresh_from_db()
        self.assertEqual(existing.supplier_product_name, 'After')
        self.assertEqual(existing.packaging_sizes, [{'size_value': 25, 'size_unit': 'g'}])

    def test_culture_update_changes_existing_supplier_data_supplier(self):
        """Changing the supplier on an existing supplier-data row should persist."""
        supplier_a = Supplier.objects.create(name='Lieferant2', homepage_url='https://supplier-a.example', project=self.project)
        supplier_b = Supplier.objects.create(name='Reinsaat', homepage_url='https://reinsaat.example', project=self.project)
        culture = Culture.objects.create(
            name='Supplier Switch',
            variety='A to B',
            growth_duration_days=10,
            harvest_duration_days=3,
            harvest_method='per_plant',
            project=self.project,
        )
        existing = CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier_a,
            project=self.project,
            supplier_product_name='Before',
            packaging_sizes=[{'size_value': 10, 'size_unit': 'g'}],
        )
        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'id': existing.id,
                    'supplier_id': supplier_b.id,
                    'supplier_product_name': 'After',
                    'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=culture).count(), 1)
        existing.refresh_from_db()
        self.assertEqual(existing.supplier_id, supplier_b.id)
        self.assertEqual(existing.supplier_product_name, 'After')
        self.assertEqual(response.data['supplier_data'][0]['supplier']['name'], 'Reinsaat')

        payload['supplier_data_input'][0]['supplier_id'] = supplier_a.id
        payload['supplier_data_input'][0]['supplier_product_name'] = 'Back to A'

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=culture).count(), 1)
        existing.refresh_from_db()
        self.assertEqual(existing.supplier_id, supplier_a.id)
        self.assertEqual(existing.supplier_product_name, 'Back to A')
        self.assertEqual(response.data['supplier_data'][0]['supplier']['name'], 'Lieferant2')

    def test_culture_update_supplier_data_without_culture_field_regression(self):
        """Regression: nested supplier rows must not fail with culture required 400."""
        supplier = Supplier.objects.create(name='Regression Supplier', homepage_url='https://regression-supplier.example', project=self.project)
        payload = {
            'id': self.culture.id,
            'name': self.culture.name,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'supplier_id': supplier.id,
                    'supplier_product_name': 'Regression row',
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('culture', response.data)
        self.assertEqual(CultureSupplierData.objects.filter(culture=self.culture, supplier=supplier).count(), 1)

    def test_culture_update_ignores_empty_supplier_data_rows(self):
        payload = {
            'id': self.culture.id,
            'name': self.culture.name,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'packaging_sizes': [],
                    'supplier_product_name': '',
                    'notes': '',
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=self.culture).count(), 0)

    def test_culture_update_rejects_supplier_data_without_supplier(self):
        payload = {
            'id': self.culture.id,
            'name': self.culture.name,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'supplier_product_name': 'Product without supplier',
                    'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('supplier_data_input', response.data)
        self.assertEqual(CultureSupplierData.objects.filter(culture=self.culture).count(), 0)

    def test_seed_demand_uses_supplier_specific_packages_for_existing_cultures(self):
        """Supplier-scoped package sizes should appear in seed demand for existing cultures."""
        culture = Culture.objects.create(
            name='Legacy Bean',
            variety='Classic',
            growth_duration_days=70,
            harvest_duration_days=14,
            harvest_method='per_plant',
            seed_rate_value=5,
            seed_rate_unit='g_per_m2',
            project=self.project,
        )
        supplier = Supplier.objects.create(
            name='Bean Supplier',
            homepage_url='https://beans.example',
            project=self.project,
        )
        CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier,
            project=self.project,
            packaging_sizes=[{'size_value': 25.0, 'size_unit': 'g'}],
        )
        PlantingPlan.objects.create(
            culture=culture,
            bed=self.bed,
            planting_date=date(2025, 3, 1),
            area_usage_sqm=5,
            project=self.project,
        )

        response = self.client.get('/openfarmplanner/api/seed-demand/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(item for item in response.data['results'] if item['culture_name'] == 'Legacy Bean')
        self.assertEqual(row['seed_packages'], [{'size_value': 25.0, 'size_unit': 'g'}])
        self.assertEqual(row['package_suggestion']['pack_count'], 1)

    def test_culture_supplier_product_url_domain_mismatch_rejected(self):
        data = {
            'name': 'Culture with URL mismatch',
            'variety': 'X',
            'supplier_id': self.supplier.id,
            'supplier_product_url': 'https://other.example/product',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'harvest_method': 'per_plant',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('supplier_product_url', response.data)


class CultureImportAPITest(DRFAPITestCase):
    """Tests for culture import API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(username='importuser', email='import@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Import Project', slug='import-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)
        self.supplier = Supplier.objects.create(name="Test Supplier", homepage_url='https://test-supplier.example', project=self.project)
        self.existing_culture = Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            supplier=self.supplier,
            growth_duration_days=60,
            harvest_duration_days=30,
            harvest_method='per_plant',
            notes="Existing notes",
            project=self.project,
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
            project=self.project,
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
            harvest_method='per_plant',
            notes="Before import",
            project=self.project,
        )
        data = {
            'items': [{
                'name': 'carrot',
                'variety': 'nantes',
                'seed_supplier': 'rainsaat r-codes',
                'growth_duration_days': 70,
                'harvest_duration_days': 30,
                'harvest_method': 'per_plant',
                'notes': 'After import',
                'project': self.project.id,
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
                'harvest_duration_days': 20,
                'harvest_method': 'per_plant',
                'project': self.project.id,
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
                'notes': 'Updated notes',
                'project': self.project.id,
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
                'harvest_method': 'per_plant',
                'notes': 'Updated notes',
                'project': self.project.id,
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
                    'harvest_duration_days': 20,
                    'harvest_method': 'per_plant',
                    'project': self.project.id,
                },
                {
                    'name': 'Tomato',
                    'variety': 'Cherry',
                    'supplier_id': self.supplier.id,
                    'growth_duration_days': 65,
                    'harvest_duration_days': 30,
                    'harvest_method': 'per_plant',
                    'project': self.project.id,
                }
            ],
            'confirm_updates': True
        }
        
        response = self.client.post('/openfarmplanner/api/cultures/import/apply/', data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created_count'], 1)
        self.assertEqual(response.data['updated_count'], 1)
        self.assertEqual(response.data['skipped_count'], 0)


class PublicCultureLibraryApiTest(DRFAPITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='library-user', email='library@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Library Project', slug='library-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)
        self.culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            growth_duration_days=50,
            harvest_duration_days=20,
            notes='Project-local notes',
            project=self.project,
        )
        SeedPackage.objects.create(culture=self.culture, project=self.project, size_value='25.0', size_unit='g')

    def publish_current_culture(self):
        return self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/',
            {'accepted_public_library_terms': True},
            format='json',
        )

    def test_publish_project_culture_creates_separate_public_culture(self):
        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'created')
        self.assertEqual(PublicCulture.objects.count(), 1)
        public_culture = PublicCulture.objects.get()
        self.assertEqual(public_culture.name, self.culture.name)
        self.assertEqual(public_culture.variety, self.culture.variety)
        self.assertEqual(public_culture.source_project_culture, self.culture)
        self.assertEqual(public_culture.seed_packages[0]['size_value'], 25.0)
        self.assertEqual(response.data['duplicates'], [])
        self.assertTrue(DocumentConsent.objects.filter(user=self.user, document=DocumentConsent.DOCUMENT_PUBLIC_LIBRARY).exists())

    def test_publish_requires_public_library_contribution_terms(self):
        response = self.client.post(f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'public_library_terms_required')
        self.assertEqual(PublicCulture.objects.count(), 0)

    def test_publish_rejects_duplicates_with_conflict_response(self):
        other_culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            project=self.project,
        )
        PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=self.user,
            source_project=self.project,
            source_project_culture=other_culture,
            supplier_name='Reinsaat',
        )
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save(update_fields=['seed_supplier', 'name_normalized', 'variety_normalized', 'updated_at'])

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'duplicate_public_culture')
        self.assertEqual(response.data['detail'], 'A similar public culture already exists.')
        self.assertEqual(len(response.data['duplicates']), 1)
        self.assertEqual(response.data['duplicates'][0]['name'], 'Lettuce')
        self.assertEqual(response.data['normalized_identity']['name'], 'lettuce')
        self.assertEqual(response.data['normalized_identity']['variety'], 'bijella')
        self.assertEqual(response.data['normalized_identity']['seed_supplier'], 'reinsaat')
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_second_publish_updates_own_linked_public_culture_and_increments_version(self):
        first_publish = self.publish_current_culture()
        self.assertEqual(first_publish.status_code, status.HTTP_201_CREATED)
        public_culture_id = first_publish.data['public_culture']['id']

        self.culture.notes = 'Updated local notes'
        self.culture.save()

        second_publish = self.publish_current_culture()

        self.assertEqual(second_publish.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_publish.data['operation'], 'updated')
        self.assertEqual(second_publish.data['public_culture']['id'], public_culture_id)
        self.assertEqual(PublicCulture.objects.count(), 1)

        updated_public = PublicCulture.objects.get(id=public_culture_id)
        self.assertEqual(updated_public.version, 2)
        self.assertEqual(updated_public.notes, 'Updated local notes')

    def test_publish_updates_own_imported_public_culture(self):
        own_public = PublicCulture.objects.create(
            name='Carrot',
            variety='Mokum',
            status='published',
            created_by=self.user,
            source_project=self.project,
            version=3,
        )
        self.culture.source_public_culture = own_public
        self.culture.name = 'Carrot'
        self.culture.variety = 'Mokum'
        self.culture.notes = 'Refined owner notes'
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'updated')
        self.assertEqual(response.data['public_culture']['id'], own_public.id)

        own_public.refresh_from_db()
        self.assertEqual(own_public.version, 4)
        self.assertEqual(own_public.notes, 'Refined owner notes')

    def test_publish_does_not_update_foreign_source_public_culture(self):
        other_user = User.objects.create_user(username='other-owner', email='other@example.com', password='testpass', is_active=True)
        foreign_public = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=other_user,
            source_project=self.project,
            source_project_culture=self.culture,
            version=5,
            supplier_name='Reinsaat',
        )
        self.culture.source_public_culture = foreign_public
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'duplicate_public_culture')
        foreign_public.refresh_from_db()
        self.assertEqual(foreign_public.version, 5)
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_publish_rejects_duplicates_using_normalized_fields(self):
        PublicCulture.objects.create(
            name=' Lettuce ',
            variety='BIJELLA',
            status='published',
            created_by=self.user,
            source_project=self.project,
            supplier_name='  Rein   Saat  ',
        )
        self.culture.name = '  lettuce'
        self.culture.variety = 'bijella  '
        self.culture.seed_supplier = 'rein saat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(len(response.data['duplicates']), 1)
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_publish_allows_new_public_culture_for_different_normalized_identity(self):
        other_culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            project=self.project,
        )
        PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=self.user,
            source_project=self.project,
            source_project_culture=other_culture,
            supplier_name='Reinsaat',
        )
        self.culture.variety = 'Other Variety'
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PublicCulture.objects.count(), 2)

    def test_import_public_culture_creates_project_local_copy(self):
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            status='published',
            created_by=self.user,
            seed_supplier='Reinsaat',
            growth_duration_days=70,
            harvest_duration_days=30,
            notes='Public notes',
            seed_packages=[{'size_value': 15.0, 'size_unit': 'g'}],
        )

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        imported = Culture.objects.get(id=response.data['id'])
        self.assertEqual(imported.project, self.project)
        self.assertEqual(imported.source_public_culture, public_culture)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertFalse(imported.is_modified_from_source)
        self.assertEqual(imported.seed_packages.count(), 1)
        self.assertEqual(float(imported.seed_packages.first().size_value), 15.0)

    def test_editing_imported_culture_does_not_change_public_culture(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Mokum',
            status='published',
            created_by=self.user,
            growth_duration_days=90,
            harvest_duration_days=14,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['growth_duration_days'] = 120
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload['supplier'] = None
        payload['supplier_id'] = None
        payload.pop('image_file', None)

        update_response = self.client.put(
            f'/openfarmplanner/api/cultures/{imported_id}/',
            payload,
            format='json',
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        imported = Culture.objects.get(id=imported_id)
        self.assertEqual(public_culture.growth_duration_days, 90)
        self.assertEqual(imported.growth_duration_days, 120)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertTrue(imported.is_modified_from_source)

    def test_editing_imported_culture_normalizes_long_origin_type_without_db_error(self):
        public_culture = PublicCulture.objects.create(
            name='Pepper',
            variety='Red Flame',
            status='published',
            created_by=self.user,
            growth_duration_days=85,
            harvest_duration_days=20,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['notes'] = 'Changed locally'
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload['origin_type'] = 'imported_from_public_library_template'
        payload['supplier'] = None
        payload['supplier_id'] = None
        payload.pop('image_file', None)

        update_response = self.client.put(f'/openfarmplanner/api/cultures/{imported_id}/', payload, format='json')

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        imported = Culture.objects.get(id=imported_id)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertTrue(imported.is_modified_from_source)

    def test_editing_imported_culture_with_supplier_name_and_null_supplier_id_keeps_supplier_null(self):
        public_culture = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=self.user,
            seed_supplier='Reinsaat',
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['notes'] = 'Local edit'
        payload['supplier_id'] = None
        payload['supplier_name'] = 'Reinsaat'
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload.pop('image_file', None)

        update_response = self.client.put(f'/openfarmplanner/api/cultures/{imported_id}/', payload, format='json')

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        imported = Culture.objects.get(id=imported_id)
        self.assertIsNone(imported.supplier_id)
        self.assertEqual(imported.seed_supplier, 'Reinsaat')

    def test_public_library_list_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/openfarmplanner/api/public-cultures/')
        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_public_library_list_returns_matching_results(self):
        PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        PublicCulture.objects.create(name='Bean', variety='Neckargold', status='published', created_by=self.user)

        response = self.client.get('/openfarmplanner/api/public-cultures/?q=Roma')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Tomato')

    def test_import_requires_project_membership_header(self):
        public_culture = PublicCulture.objects.create(name='Kale', variety='Nero', status='published', created_by=self.user)
        del self.client.defaults['HTTP_X_PROJECT_ID']

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
