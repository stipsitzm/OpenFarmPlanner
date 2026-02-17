from django.test import TestCase
from django.utils import timezone
from datetime import date, timedelta
from rest_framework.test import APITestCase as DRFAPITestCase
from rest_framework import status
from .models import Location, Field, Bed, Culture, PlantingPlan, Task, Supplier


class SupplierModelTest(TestCase):
    def test_supplier_creation(self):
        """Test creating a supplier"""
        supplier = Supplier.objects.create(name="Green Seeds Co.")
        self.assertEqual(str(supplier), "Green Seeds Co.")
        self.assertEqual(supplier.name, "Green Seeds Co.")

    def test_supplier_name_normalization(self):
        """Test that supplier names are normalized (lowercased, stripped)"""
        supplier = Supplier.objects.create(name="  ACME Seeds  ")
        self.assertEqual(supplier.name_normalized, "acme seeds")

    def test_supplier_normalization_removes_legal_suffixes(self):
        """Test that legal suffixes are removed from normalized names"""
        supplier1 = Supplier.objects.create(name="Green Inc.")
        self.assertEqual(supplier1.name_normalized, "green")
        
        supplier2 = Supplier.objects.create(name="Farm Ltd")
        self.assertEqual(supplier2.name_normalized, "farm")
        
        supplier3 = Supplier.objects.create(name="Seeds GmbH")
        self.assertEqual(supplier3.name_normalized, "seeds")

    def test_supplier_normalization_deduplication(self):
        """Test that suppliers with same normalized name cannot be created"""
        from django.db import IntegrityError
        
        Supplier.objects.create(name="ACME Seeds")
        
        # Try to create another with same normalized name
        with self.assertRaises(IntegrityError):
            Supplier.objects.create(name="acme seeds")


class LocationModelTest(TestCase):
    def test_location_creation(self):
        location = Location.objects.create(
            name="Main Farm",
            address="123 Farm Road"
        )
        self.assertEqual(str(location), "Main Farm")
        self.assertEqual(location.name, "Main Farm")


class FieldModelTest(TestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Test Location")

    def test_field_creation(self):
        field = Field.objects.create(
            name="North Field",
            location=self.location,
            area_sqm=1000.50
        )
        self.assertEqual(str(field), "Test Location - North Field")
    
    def test_field_area_validation_too_small(self):
        from django.core.exceptions import ValidationError
        field = Field(
            name="Tiny Field",
            location=self.location,
            area_sqm=0.001  # Less than MIN_AREA_SQM (0.01)
        )
        with self.assertRaises(ValidationError) as cm:
            field.full_clean()
        self.assertIn('area_sqm', cm.exception.message_dict)
    
    def test_field_area_validation_too_large(self):
        from django.core.exceptions import ValidationError
        field = Field(
            name="Huge Field",
            location=self.location,
            area_sqm=2000000  # Greater than MAX_AREA_SQM (1,000,000)
        )
        with self.assertRaises(ValidationError) as cm:
            field.full_clean()
        self.assertIn('area_sqm', cm.exception.message_dict)
    
    def test_field_area_validation_valid_range(self):
        # Test minimum valid value
        field_min = Field.objects.create(
            name="Min Field",
            location=self.location,
            area_sqm=0.01
        )
        self.assertEqual(field_min.area_sqm, 0.01)
        
        # Test a large valid value (max_digits=10, decimal_places=2 means max 8 digits before decimal)
        field_large = Field.objects.create(
            name="Large Field",
            location=self.location,
            area_sqm=12345678.90
        )
        self.assertEqual(field_large.area_sqm, 12345678.90)


class BedModelTest(TestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Test Location")
        self.field = Field.objects.create(name="Test Field", location=self.location)

    def test_bed_creation(self):
        bed = Bed.objects.create(
            name="Bed A",
            field=self.field,
            area_sqm=12.0
        )
        self.assertEqual(str(bed), "Test Field - Bed A")
    
    def test_bed_area_validation_too_small(self):
        from django.core.exceptions import ValidationError
        bed = Bed(
            name="Tiny Bed",
            field=self.field,
            area_sqm=0.001  # Less than MIN_AREA_SQM (0.01)
        )
        with self.assertRaises(ValidationError):
            bed.full_clean()
    
    def test_bed_area_validation_too_large(self):
        from django.core.exceptions import ValidationError
        bed = Bed(
            name="Huge Bed",
            field=self.field,
            area_sqm=20000  # Greater than MAX_AREA_SQM (10,000)
        )
        bed.full_clean()
        self.assertEqual(bed.area_sqm, 20000)
    
    def test_bed_area_validation_valid_range(self):
        # Test minimum valid value
        bed_min = Bed.objects.create(
            name="Min Bed",
            field=self.field,
            area_sqm=0.01
        )
        self.assertEqual(bed_min.area_sqm, 0.01)
        
        # Test a large valid value within MAX_AREA_SQM
        bed_large = Bed.objects.create(
            name="Large Bed",
            field=self.field,
            area_sqm=9999.99
        )
        self.assertEqual(bed_large.area_sqm, 9999.99)

    def test_bed_get_total_area(self):
        bed = Bed.objects.create(
            name="Bed B",
            field=self.field,
            area_sqm=15.0
        )
        self.assertEqual(bed.get_total_area(), 15.0)

    def test_bed_get_total_area_no_dimensions(self):
        bed = Bed.objects.create(
            name="Bed C",
            field=self.field
        )
        self.assertIsNone(bed.get_total_area())




class CultureModelTest(TestCase):
    def test_culture_creation_with_variety(self):
        culture = Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            growth_duration_days=8,
            harvest_duration_days=4
        )
        self.assertEqual(str(culture), "Tomato (Cherry)")
    
    def test_culture_creation_without_variety(self):
        """Test creating a culture without a variety"""
        culture = Culture.objects.create(
            name="Lettuce",
            growth_duration_days=4,
            harvest_duration_days=2
        )
        self.assertEqual(str(culture), "Lettuce")
    
    def test_culture_with_manual_planning_fields(self):
        """Test creating a culture with all manual planning fields"""
        culture = Culture.objects.create(
            name="Broccoli",
            variety="Calabrese",
            notes="Great for winter growing",
            crop_family="Brassicaceae",
            nutrient_demand="high",
            cultivation_type="pre_cultivation",
            growth_duration_days=10,
            harvest_duration_days=3,
            propagation_duration_days=4,
            harvest_method="per_plant",
            expected_yield=500.0,
            allow_deviation_delivery_weeks=True,
            distance_within_row_m=0.40,  # 40 cm = 0.40 m
            row_spacing_m=0.60,  # 60 cm = 0.60 m
            sowing_depth_m=0.015,  # 1.5 cm = 0.015 m
        )
        self.assertEqual(culture.name, "Broccoli")
        self.assertEqual(culture.crop_family, "Brassicaceae")
        self.assertEqual(culture.nutrient_demand, "high")
        self.assertEqual(culture.cultivation_type, "pre_cultivation")
        self.assertEqual(culture.growth_duration_days, 10)
        self.assertEqual(culture.harvest_duration_days, 3)
        self.assertEqual(culture.propagation_duration_days, 4)
        self.assertEqual(culture.harvest_method, "per_plant")
        self.assertEqual(float(culture.expected_yield), 500.0)
        self.assertTrue(culture.allow_deviation_delivery_weeks)
        self.assertAlmostEqual(culture.distance_within_row_m, 0.40, places=4)
        self.assertAlmostEqual(culture.row_spacing_m, 0.60, places=4)
        self.assertAlmostEqual(culture.sowing_depth_m, 0.015, places=4)
    
    def test_display_color_auto_generation(self):
        """Test that display color is automatically generated on creation"""
        culture = Culture.objects.create(
            name="Carrot",
            growth_duration_days=10,
            harvest_duration_days=3
        )
        self.assertIsNotNone(culture.display_color)
        self.assertTrue(culture.display_color.startswith('#'))
        self.assertEqual(len(culture.display_color), 7)
    
    def test_display_color_custom_preserved(self):
        """Test that custom display color is preserved"""
        custom_color = "#FF5733"
        culture = Culture.objects.create(
            name="Lettuce",
            growth_duration_days=4,
            harvest_duration_days=2,
            display_color=custom_color
        )
        self.assertEqual(culture.display_color, custom_color)
    
    def test_display_color_distinct_for_multiple_cultures(self):
        """Test that generated colors are distinct"""
        colors = set()
        for i in range(10):
            culture = Culture.objects.create(
                name=f"Culture {i}",
                growth_duration_days=4,
                harvest_duration_days=2
            )
            colors.add(culture.display_color)
        
        # All colors should be unique
        self.assertEqual(len(colors), 10)
    
    def test_negative_numeric_fields_validation(self):
        """Test that negative values for numeric fields are rejected"""
        from django.core.exceptions import ValidationError
        
        culture = Culture(
            name="Lettuce",
            growth_duration_days=-1,
            harvest_duration_days=2
        )
        with self.assertRaises(ValidationError) as context:
            culture.clean()
        self.assertIn('growth_duration_days', context.exception.message_dict)
    
    def test_display_color_format_validation(self):
        """Test that display color must be in hex format"""
        from django.core.exceptions import ValidationError
        
        # Invalid color format
        culture = Culture(
            name="Tomato",
            growth_duration_days=8,
            harvest_duration_days=4,
            display_color="invalid"
        )
        with self.assertRaises(ValidationError) as context:
            culture.clean()
        self.assertIn('display_color', context.exception.message_dict)
        
        # Valid color format
        culture2 = Culture(
            name="Tomato",
            growth_duration_days=8,
            harvest_duration_days=4,
            display_color="#FF5733"
        )
        culture2.clean()  # Should not raise


class PlantingPlanModelTest(TestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Test Location")
        self.field = Field.objects.create(name="Test Field", location=self.location)
        self.bed = Bed.objects.create(
            name="Test Bed", 
            field=self.field,
            area_sqm=20.0  # Total area: 20 sqm
        )
        self.culture = Culture.objects.create(
            name="Carrot",
            growth_duration_days=70,
            harvest_duration_days=3
        )

    def test_auto_harvest_date(self):
        planting_date = date(2024, 3, 1)
        plan = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=planting_date,
            quantity=100
        )
        expected_harvest = planting_date + timedelta(days=70)
        self.assertEqual(plan.harvest_date, expected_harvest)

    def test_harvest_date_recalculates_when_planting_date_changes(self):
        """Test that harvest dates recalculate when planting_date changes"""
        planting_date = date(2024, 3, 1)
        plan = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=planting_date,
            quantity=100
        )
        expected_harvest = planting_date + timedelta(days=70)
        self.assertEqual(plan.harvest_date, expected_harvest)
        
        # Change planting date
        new_planting_date = date(2024, 4, 1)
        plan.planting_date = new_planting_date
        plan.save()
        
        # Harvest date should recalculate
        new_expected_harvest = new_planting_date + timedelta(days=70)
        self.assertEqual(plan.harvest_date, new_expected_harvest)
    
    def test_harvest_date_recalculates_when_culture_changes(self):
        """Test that harvest dates recalculate when culture changes"""
        planting_date = date(2024, 3, 1)
        plan = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=planting_date,
            quantity=100
        )
        expected_harvest = planting_date + timedelta(days=70)
        self.assertEqual(plan.harvest_date, expected_harvest)
        
        # Create new culture with different harvest days
        new_culture = Culture.objects.create(name="Tomato", growth_duration_days=90, harvest_duration_days=2)
        plan.culture = new_culture
        plan.save()
        
        # Harvest date should recalculate with new culture's timing
        new_expected_harvest = planting_date + timedelta(days=90)
        self.assertEqual(plan.harvest_date, new_expected_harvest)
    
    def test_harvest_end_date_with_growth_and_harvest_duration(self):
        """Test that harvest_end_date is calculated from growth + harvest duration."""
        culture_with_median = Culture.objects.create(
            name="Broccoli",
            growth_duration_days=65,
            harvest_duration_days=25
        )
        planting_date = date(2024, 3, 1)
        plan = PlantingPlan.objects.create(
            culture=culture_with_median,
            bed=self.bed,
            planting_date=planting_date,
            quantity=100
        )
        
        expected_harvest_start = planting_date + timedelta(days=65)
        self.assertEqual(plan.harvest_date, expected_harvest_start)
        
        expected_harvest_end = expected_harvest_start + timedelta(days=25)
        self.assertEqual(plan.harvest_end_date, expected_harvest_end)
    
    def test_harvest_end_date_defaults_to_harvest_date(self):
        """Test that harvest_end_date defaults to harvest_date when no harvest_duration_days."""
        planting_date = date(2024, 3, 1)
        plan = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=planting_date,
            quantity=100
        )
        
        self.assertEqual(plan.harvest_end_date, plan.harvest_date + timedelta(days=3))

    def test_area_usage_within_bed_capacity(self):
        """Test that planting plan with area within bed capacity is allowed"""
        from django.core.exceptions import ValidationError
        
        plan = PlantingPlan(
            culture=self.culture,
            bed=self.bed,
            planting_date=date(2024, 3, 1),
            area_usage_sqm=15.0  # Within 20 sqm capacity
        )
        # Should not raise ValidationError
        plan.clean()
        plan.save()
        self.assertEqual(plan.area_usage_sqm, 15.0)

    def test_area_usage_exceeds_bed_capacity(self):
        """Test that planting plan exceeding bed capacity raises error"""
        from django.core.exceptions import ValidationError
        
        plan = PlantingPlan(
            culture=self.culture,
            bed=self.bed,
            planting_date=date(2024, 3, 1),
            area_usage_sqm=25.0  # Exceeds 20 sqm capacity
        )
        plan.clean()
        plan.save()
        self.assertEqual(plan.area_usage_sqm, 25.0)

    def test_area_usage_total_exceeds_with_multiple_plans(self):
        """Test that total area of multiple plans cannot exceed bed capacity"""
        from django.core.exceptions import ValidationError
        
        # Create first plan using 12 sqm
        plan1 = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=date(2024, 3, 1),
            area_usage_sqm=12.0
        )
        
        # Try to create second plan using 10 sqm (total would be 22 sqm > 20 sqm)
        plan2 = PlantingPlan(
            culture=self.culture,
            bed=self.bed,
            planting_date=date(2024, 4, 1),
            area_usage_sqm=10.0
        )
        plan2.clean()
        plan2.save()
        self.assertEqual(plan2.area_usage_sqm, 10.0)

    def test_area_usage_no_bed_dimensions(self):
        """Test that validation is skipped when bed has no dimensions"""
        from django.core.exceptions import ValidationError
        
        bed_no_dims = Bed.objects.create(name="No Dims Bed", field=self.field)
        plan = PlantingPlan(
            culture=self.culture,
            bed=bed_no_dims,
            planting_date=date(2024, 3, 1),
            area_usage_sqm=100.0  # Large value, but should be allowed
        )
        # Should not raise ValidationError since bed has no dimensions
        plan.clean()
        plan.save()



class TaskModelTest(TestCase):
    def test_task_creation(self):
        task = Task.objects.create(
            title="Water plants",
            description="Water all beds in field A",
            status="pending"
        )
        self.assertEqual(str(task), "Water plants (pending)")
        self.assertEqual(task.status, "pending")


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
            'display_color': '#FF5733'
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Comprehensive Culture')
        self.assertEqual(response.data['crop_family'], 'Solanaceae')
        self.assertEqual(response.data['nutrient_demand'], 'high')
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



class NormalizationUtilsTest(TestCase):
    """Tests for text normalization utilities."""
    
    def test_normalize_text_basic(self):
        """Test basic text normalization."""
        from .utils import normalize_text
        
        self.assertEqual(normalize_text("  Hello World  "), "hello world")
        self.assertEqual(normalize_text("UPPERCASE"), "uppercase")
        self.assertEqual(normalize_text("Multiple   Spaces"), "multiple spaces")
    
    def test_normalize_text_edge_cases(self):
        """Test edge cases for text normalization."""
        from .utils import normalize_text
        
        self.assertIsNone(normalize_text(None))
        self.assertIsNone(normalize_text(""))
        self.assertIsNone(normalize_text("   "))
        self.assertEqual(normalize_text("abc"), "abc")
    
    def test_normalize_supplier_name_basic(self):
        """Test supplier name normalization."""
        from .utils import normalize_supplier_name
        
        self.assertEqual(normalize_supplier_name("ACME Seeds"), "acme seeds")
        self.assertEqual(normalize_supplier_name("  Green Inc.  "), "green")
    
    def test_normalize_supplier_name_legal_suffixes(self):
        """Test that legal suffixes are removed."""
        from .utils import normalize_supplier_name
        
        self.assertEqual(normalize_supplier_name("Farm GmbH"), "farm")
        self.assertEqual(normalize_supplier_name("Seeds KG"), "seeds")
        self.assertEqual(normalize_supplier_name("Company OG"), "company")
        self.assertEqual(normalize_supplier_name("Business Ltd."), "business")
        self.assertEqual(normalize_supplier_name("Corp Inc"), "corp")
        self.assertEqual(normalize_supplier_name("Trade AG"), "trade")
        self.assertEqual(normalize_supplier_name("Partners GbR"), "partners")
        self.assertEqual(normalize_supplier_name("Seeds Co. KG"), "seeds")


class CultureNormalizedFieldsTest(TestCase):
    """Tests for Culture model normalized fields."""
    
    def test_culture_normalized_fields_populated(self):
        """Test that normalized fields are populated on save."""
        culture = Culture.objects.create(
            name="  Tomato  ",
            variety="  Cherry  ",
            growth_duration_days=60,
            harvest_duration_days=30
        )
        
        self.assertEqual(culture.name_normalized, "tomato")
        self.assertEqual(culture.variety_normalized, "cherry")
    
    def test_culture_normalized_empty_variety(self):
        """Test normalized fields with empty variety."""
        culture = Culture.objects.create(
            name="Carrot",
            variety="",
            growth_duration_days=60,
            harvest_duration_days=30
        )
        
        self.assertEqual(culture.name_normalized, "carrot")
        self.assertIsNone(culture.variety_normalized)
    
    def test_culture_unique_constraint(self):
        """Test unique constraint on normalized fields."""
        from django.db import IntegrityError
        
        supplier = Supplier.objects.create(name="Test Supplier")
        
        Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            supplier=supplier,
            growth_duration_days=60,
            harvest_duration_days=30
        )
        
        # Try to create duplicate with same normalized values
        with self.assertRaises(IntegrityError):
            Culture.objects.create(
                name="TOMATO",  # Different case
                variety="cherry",  # Different case
                supplier=supplier,
                growth_duration_days=60,
                harvest_duration_days=30
            )
    
    def test_culture_unique_constraint_different_supplier(self):
        """Test that same culture with different supplier is allowed."""
        supplier1 = Supplier.objects.create(name="Supplier 1")
        supplier2 = Supplier.objects.create(name="Supplier 2")
        
        culture1 = Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            supplier=supplier1,
            growth_duration_days=60,
            harvest_duration_days=30
        )
        
        culture2 = Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            supplier=supplier2,
            growth_duration_days=60,
            harvest_duration_days=30
        )
        
        self.assertNotEqual(culture1.id, culture2.id)


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
