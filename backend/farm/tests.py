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


class BedModelTest(TestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Test Location")
        self.field = Field.objects.create(name="Test Field", location=self.location)

    def test_bed_creation(self):
        bed = Bed.objects.create(
            name="Bed A",
            field=self.field,
            length_m=10.0,
            width_m=1.2
        )
        self.assertEqual(str(bed), "Test Field - Bed A")


class CultureModelTest(TestCase):
    def test_culture_creation_with_variety(self):
        culture = Culture.objects.create(
            name="Tomato",
            variety="Cherry",
            days_to_harvest=60
        )
        self.assertEqual(str(culture), "Tomato (Cherry)")

    def test_culture_creation_without_variety(self):
        culture = Culture.objects.create(
            name="Lettuce",
            days_to_harvest=30
        )
        self.assertEqual(str(culture), "Lettuce")


class PlantingPlanModelTest(TestCase):
    def setUp(self):
        self.location = Location.objects.create(name="Test Location")
        self.field = Field.objects.create(name="Test Field", location=self.location)
        self.bed = Bed.objects.create(name="Test Bed", field=self.field)
        self.culture = Culture.objects.create(name="Carrot", days_to_harvest=70)

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

    def test_manual_harvest_date(self):
        planting_date = date(2024, 3, 1)
        manual_harvest = date(2024, 5, 15)
        plan = PlantingPlan.objects.create(
            culture=self.culture,
            bed=self.bed,
            planting_date=planting_date,
            harvest_date=manual_harvest,
            quantity=100
        )
        self.assertEqual(plan.harvest_date, manual_harvest)


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
        self.bed = Bed.objects.create(name="API Test Bed", field=self.field)
        self.culture = Culture.objects.create(name="API Test Culture", days_to_harvest=50)

    def test_culture_list(self):
        response = self.client.get('/api/cultures/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_culture_create(self):
        data = {
            'name': 'New Culture',
            'variety': 'Test Variety',
            'days_to_harvest': 45
        }
        response = self.client.post('/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Culture.objects.count(), 2)

    def test_bed_list(self):
        response = self.client.get('/api/beds/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_planting_plan_create(self):
        data = {
            'culture': self.culture.id,
            'bed': self.bed.id,
            'planting_date': '2024-03-01',
            'quantity': 50
        }
        response = self.client.post('/api/planting-plans/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('harvest_date', response.data)


class OpenFarmImportTest(TestCase):
    """Test OpenFarm data import functionality."""
    
    def test_map_basic_plant(self):
        """Test mapping a basic plant with minimal data."""
        from farm.openfarm_import import map_openfarm_plant_to_culture
        
        plant_data = {
            '_id': 'test-1',
            'name': 'Test Plant',
            'slug': 'test-plant',
        }
        
        result = map_openfarm_plant_to_culture(plant_data)
        
        self.assertEqual(result['name'], 'Test Plant')
        self.assertEqual(result['openfarm_id'], 'test-1')
        self.assertEqual(result['openfarm_slug'], 'test-plant')
        self.assertEqual(result['openfarm_raw'], plant_data)
    
    def test_map_plant_with_variety(self):
        """Test mapping a plant with variety/cultivar."""
        from farm.openfarm_import import map_openfarm_plant_to_culture
        
        plant_data = {
            '_id': 'cherry-tomato',
            'name': 'Tomato',
            'cultivar_name': 'Cherry',
            'slug': 'cherry-tomato',
        }
        
        result = map_openfarm_plant_to_culture(plant_data)
        
        self.assertEqual(result['name'], 'Tomato')
        self.assertEqual(result['variety'], 'Cherry')
    
    def test_map_plant_with_full_data(self):
        """Test mapping a plant with comprehensive OpenFarm data."""
        from farm.openfarm_import import map_openfarm_plant_to_culture
        
        plant_data = {
            '_id': 'tomato-1',
            'name': 'Tomato',
            'slug': 'tomato',
            'binomial_name': 'Solanum lycopersicum',
            'common_names': ['Tomato', 'Tomate'],
            'description': 'A delicious red fruit',
            'sun_requirements': 'full sun',
            'sowing_method': 'transplant',
            'spread': 60,
            'row_spacing': 90,
            'height': 150,
            'growing_degree_days': 1500,
            'taxon': 'Species',
        }
        
        result = map_openfarm_plant_to_culture(plant_data)
        
        self.assertEqual(result['binomial_name'], 'Solanum lycopersicum')
        self.assertEqual(result['common_names'], ['Tomato', 'Tomate'])
        self.assertEqual(result['sun_requirements'], 'full sun')
        self.assertEqual(result['sowing_method'], 'transplant')
        self.assertEqual(result['spread_cm'], 60)
        self.assertEqual(result['plant_spacing_cm'], 60)  # Derived from spread
        self.assertEqual(result['row_spacing_cm'], 90)
        self.assertEqual(result['height_cm'], 150)
        self.assertEqual(result['growing_degree_days'], 1500)
        self.assertEqual(result['taxon'], 'Species')
    
    def test_map_plant_missing_name_raises_skip(self):
        """Test that mapping a plant without a name raises SkipPlant."""
        from farm.openfarm_import import map_openfarm_plant_to_culture, SkipPlant
        
        plant_data = {
            '_id': 'no-name',
            'slug': 'no-name',
        }
        
        with self.assertRaises(SkipPlant) as context:
            map_openfarm_plant_to_culture(plant_data)
        
        self.assertIn('name', str(context.exception).lower())
    
    def test_map_plant_handles_string_common_names(self):
        """Test that mapping handles common_names as a string."""
        from farm.openfarm_import import map_openfarm_plant_to_culture
        
        plant_data = {
            '_id': 'test-2',
            'name': 'Test Plant',
            'common_names': 'Single Name',
        }
        
        result = map_openfarm_plant_to_culture(plant_data)
        
        self.assertEqual(result['common_names'], ['Single Name'])
    
    def test_get_upsert_key_with_openfarm_id(self):
        """Test upsert key generation when openfarm_id is present."""
        from farm.openfarm_import import get_upsert_key
        
        culture_data = {
            'name': 'Tomato',
            'variety': 'Cherry',
            'openfarm_id': 'tomato-123',
        }
        
        key = get_upsert_key(culture_data)
        
        self.assertEqual(key, {'openfarm_id': 'tomato-123'})
    
    def test_get_upsert_key_without_openfarm_id(self):
        """Test upsert key generation when openfarm_id is absent."""
        from farm.openfarm_import import get_upsert_key
        
        culture_data = {
            'name': 'Tomato',
            'variety': 'Cherry',
        }
        
        key = get_upsert_key(culture_data)
        
        self.assertEqual(key, {'name': 'Tomato', 'variety': 'Cherry'})
    
    def test_culture_upsert_by_openfarm_id(self):
        """Test upserting a Culture by openfarm_id."""
        # Create initial culture
        culture_data = {
            'name': 'Lettuce',
            'openfarm_id': 'lettuce-1',
            'spread_cm': 25,
        }
        
        culture = Culture.objects.create(**culture_data)
        initial_id = culture.id
        
        # Update with same openfarm_id
        updated_data = {
            'name': 'Lettuce Updated',
            'openfarm_id': 'lettuce-1',
            'spread_cm': 30,
            'description': 'Updated description',
        }
        
        culture, created = Culture.objects.update_or_create(
            openfarm_id='lettuce-1',
            defaults=updated_data
        )
        
        self.assertFalse(created)
        self.assertEqual(culture.id, initial_id)
        self.assertEqual(culture.name, 'Lettuce Updated')
        self.assertEqual(culture.spread_cm, 30)
        self.assertEqual(culture.description, 'Updated description')
    
    def test_culture_upsert_by_name_variety(self):
        """Test upserting a Culture by name and variety."""
        # Create initial culture
        culture_data = {
            'name': 'Tomato',
            'variety': 'Cherry',
            'spread_cm': 50,
        }
        
        culture = Culture.objects.create(**culture_data)
        initial_id = culture.id
        
        # Update with same name/variety
        updated_data = {
            'name': 'Tomato',
            'variety': 'Cherry',
            'spread_cm': 60,
            'description': 'Cherry tomato variety',
        }
        
        culture, created = Culture.objects.update_or_create(
            name='Tomato',
            variety='Cherry',
            defaults=updated_data
        )
        
        self.assertFalse(created)
        self.assertEqual(culture.id, initial_id)
        self.assertEqual(culture.spread_cm, 60)
        self.assertEqual(culture.description, 'Cherry tomato variety')
    
    def test_culture_with_openfarm_fields(self):
        """Test creating a Culture with OpenFarm-specific fields."""
        culture = Culture.objects.create(
            name='Basil',
            openfarm_id='basil-1',
            openfarm_slug='basil',
            binomial_name='Ocimum basilicum',
            common_names=['Basil', 'Sweet Basil'],
            sun_requirements='full sun',
            sowing_method='direct seed',
            spread_cm=30,
            plant_spacing_cm=30,
            row_spacing_cm=30,
            height_cm=60,
            taxon='Species',
            description='Aromatic herb',
            openfarm_raw={'_id': 'basil-1', 'name': 'Basil'},
        )
        
        self.assertEqual(culture.name, 'Basil')
        self.assertEqual(culture.binomial_name, 'Ocimum basilicum')
        self.assertIn('Basil', culture.common_names)
        self.assertEqual(culture.openfarm_raw['name'], 'Basil')
    
    def test_culture_get_days_to_harvest_method(self):
        """Test the get_days_to_harvest helper method."""
        # Test with maturity_days set
        culture1 = Culture.objects.create(
            name='Test1',
            maturity_days=50,
            days_to_harvest=60
        )
        self.assertEqual(culture1.get_days_to_harvest(), 50)
        
        # Test with only days_to_harvest set
        culture2 = Culture.objects.create(
            name='Test2',
            days_to_harvest=60
        )
        self.assertEqual(culture2.get_days_to_harvest(), 60)
        
        # Test with neither set
        culture3 = Culture.objects.create(
            name='Test3'
        )
        self.assertEqual(culture3.get_days_to_harvest(), 0)
        
        # Test with maturity_days explicitly set to 0 (edge case)
        culture4 = Culture.objects.create(
            name='Test4',
            maturity_days=0,
            days_to_harvest=60
        )
        self.assertEqual(culture4.get_days_to_harvest(), 0)

