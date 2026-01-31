from django.test import TestCase
from django.utils import timezone
from datetime import date, timedelta
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Location, Field, Bed, Culture, PlantingPlan, Task


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
        with self.assertRaises(ValidationError) as cm:
            bed.full_clean()
        self.assertIn('area_sqm', cm.exception.message_dict)
    
    def test_bed_area_validation_too_large(self):
        from django.core.exceptions import ValidationError
        bed = Bed(
            name="Huge Bed",
            field=self.field,
            area_sqm=20000  # Greater than MAX_AREA_SQM (10,000)
        )
        with self.assertRaises(ValidationError) as cm:
            bed.full_clean()
        self.assertIn('area_sqm', cm.exception.message_dict)
    
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

                        growth_duration_days=8,
        culture = Culture.objects.create(
            name="Lettuce",
            growth_duration_days=4,
            harvest_duration_days=2
        )
        self.assertEqual(str(culture), "Lettuce")
    
                        growth_duration_days=4,
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
                        growth_duration_days=10,
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
    
                        growth_duration_days=-1,
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
                    expected_harvest = planting_date + timedelta(days=self.culture.growth_duration_days)
                growth_duration_days=4,
                harvest_duration_days=2
            )
            colors.add(culture.display_color)
        
        # All colors should be unique
        self.assertEqual(len(colors), 10)
    
    def test_negative_numeric_fields_validation(self):
        """Test that negative values for numeric fields are rejected"""
                        area_usage_sqm=self.culture.growth_duration_days,  # Corrected to use growth_duration_days
        
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
            days_to_harvest=70,
            growth_duration_days=10,
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
        new_culture = Culture.objects.create(name="Tomato", days_to_harvest=90)
        plan.culture = new_culture
        plan.save()
        
        # Harvest date should recalculate with new culture's timing
        new_expected_harvest = planting_date + timedelta(days=90)
        self.assertEqual(plan.harvest_date, new_expected_harvest)
    
    def test_harvest_end_date_with_median_days(self):
        """Test that harvest_end_date is calculated from median_days_to_last_harvest"""
        culture_with_median = Culture.objects.create(
            name="Broccoli",
            days_to_harvest=60,
            median_days_to_first_harvest=65,
            median_days_to_last_harvest=90
        )
        planting_date = date(2024, 3, 1)
        plan = PlantingPlan.objects.create(
            culture=culture_with_median,
            bed=self.bed,
            planting_date=planting_date,
            quantity=100
        )
        
        # harvest_date should use median_days_to_first_harvest
        expected_harvest_start = planting_date + timedelta(days=65)
        self.assertEqual(plan.harvest_date, expected_harvest_start)
        
        # harvest_end_date should use median_days_to_last_harvest
        expected_harvest_end = planting_date + timedelta(days=90)
        self.assertEqual(plan.harvest_end_date, expected_harvest_end)
    
    def test_harvest_end_date_defaults_to_harvest_date(self):
        """Test that harvest_end_date defaults to harvest_date when no median_days_to_last_harvest"""
        planting_date = date(2024, 3, 1)
        plan = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=planting_date,
            quantity=100
        )
        
        # harvest_end_date should default to harvest_date (single-day window)
        self.assertEqual(plan.harvest_end_date, plan.harvest_date)

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
        with self.assertRaises(ValidationError) as context:
            plan.clean()
        self.assertIn('area_usage_sqm', context.exception.message_dict)

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
        with self.assertRaises(ValidationError) as context:
            plan2.clean()
        self.assertIn('area_usage_sqm', context.exception.message_dict)

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


class APITestCase(APITestCase):
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
            days_to_harvest=50,
            growth_duration_days=7,
            harvest_duration_days=2
        )

    def test_culture_list(self):
        response = self.client.get('/openfarmplanner/api/cultures/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_culture_create(self):
        data = {
            'name': 'New Culture',
            'variety': 'Test Variety',
            'days_to_harvest': 45,
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
            'days_to_harvest': 60,
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
            'days_to_harvest': 45,
            # Missing growth_duration_days and harvest_duration_days
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('growth_duration_days', response.data)
        self.assertIn('harvest_duration_days', response.data)
    
    def test_culture_create_invalid_display_color(self):
        """Test that invalid display color format is rejected"""
        data = {
            'name': 'Test Culture',
            'days_to_harvest': 45,
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
            'days_to_harvest': 55,
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
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_usage_sqm', response.data)

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
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('area_usage_sqm', response2.data)

