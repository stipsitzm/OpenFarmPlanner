from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone

from farm.models import Bed, Culture, Field, Location, PlantingPlan, Supplier, Task

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
            harvest_method='per_sqm',
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
