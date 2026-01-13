import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from farm.models import Location, Field, Bed, Culture, PlantingPlan
from datetime import date

# Create sample data
location = Location.objects.create(name="Hauptstandort", address="Musterstraße 1")
field = Field.objects.create(name="Feld A", location=location, area_sqm=1000)
bed1 = Bed.objects.create(name="Beet 1", field=field, area_sqm=25)
bed2 = Bed.objects.create(name="Beet 2", field=field, area_sqm=30)
bed3 = Bed.objects.create(name="Beet 3", field=field, area_sqm=20)

# Create cultures with both old and new fields
tomato = Culture.objects.create(
    name="Tomate",
    variety="Cherry",
    days_to_harvest=70,  # Legacy field
    growth_duration_days=70,
    harvest_duration_days=30,
    notes="Rote Kirschtomaten"
)
cucumber = Culture.objects.create(
    name="Gurke",
    variety="Salatgurke",
    days_to_harvest=50,  # Legacy field
    growth_duration_days=50,
    harvest_duration_days=20,
    notes="Lange Salatgurken"
)
lettuce = Culture.objects.create(
    name="Kopfsalat",
    variety="Grün",
    days_to_harvest=40,  # Legacy field
    growth_duration_days=40,
    harvest_duration_days=10,
    notes="Grüner Kopfsalat"
)
carrot = Culture.objects.create(
    name="Karotte",
    variety="Nantaise",
    days_to_harvest=60,  # Legacy field
    growth_duration_days=60,
    harvest_duration_days=15,
    notes="Orange Möhren"
)

# Create planting plans for 2026
year = 2026

# Tomato - planted in May, harvested in July-August
PlantingPlan.objects.create(
    culture=tomato,
    bed=bed1,
    planting_date=date(year, 5, 1),
    area_usage_sqm=20,
    notes="Frühe Tomaten"
)

# Cucumber - planted in June, harvested in July-August
PlantingPlan.objects.create(
    culture=cucumber,
    bed=bed2,
    planting_date=date(year, 6, 1),
    area_usage_sqm=25,
    notes="Gewächshausgurken"
)

# Lettuce - multiple successions
PlantingPlan.objects.create(
    culture=lettuce,
    bed=bed3,
    planting_date=date(year, 4, 1),
    area_usage_sqm=10,
    notes="Frühlingssalat"
)
PlantingPlan.objects.create(
    culture=lettuce,
    bed=bed3,
    planting_date=date(year, 6, 15),
    area_usage_sqm=10,
    notes="Sommersalat"
)

# Carrot - planted in April, harvested in June
PlantingPlan.objects.create(
    culture=carrot,
    bed=bed1,
    planting_date=date(year, 4, 15),
    area_usage_sqm=15,
    notes="Frühe Karotten"
)

# Tomato - second succession
PlantingPlan.objects.create(
    culture=tomato,
    bed=bed2,
    planting_date=date(year, 7, 1),
    area_usage_sqm=20,
    notes="Späte Tomaten"
)

print("Sample data loaded successfully!")
print(f"Created {Location.objects.count()} location(s)")
print(f"Created {Field.objects.count()} field(s)")
print(f"Created {Bed.objects.count()} bed(s)")
print(f"Created {Culture.objects.count()} culture(s)")
print(f"Created {PlantingPlan.objects.count()} planting plan(s)")
