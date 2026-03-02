from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework import serializers

from farm.models import Bed, Culture, Field, Location, PlantingPlan, Supplier
from farm.serializers import CentimetersField, CultureSerializer, PlantingPlanSerializer
from farm.utils.normalization import normalize_supplier_name, normalize_text


class NormalizationUtilsTest(TestCase):
    def test_normalize_text_handles_none_blank_and_casefold(self):
        self.assertIsNone(normalize_text(None))
        self.assertIsNone(normalize_text('   '))
        self.assertEqual(normalize_text('  Äpfel\t UND  Birnen  '), 'äpfel und birnen')

    def test_normalize_supplier_name_removes_suffixes_and_trims(self):
        self.assertEqual(normalize_supplier_name('  Farm Co. KG '), 'farm')
        self.assertEqual(normalize_supplier_name('Green Ltd.'), 'green')
        self.assertIsNone(normalize_supplier_name('   '))


class SerializerBranchCoverageTest(TestCase):
    def setUp(self):
        self.location = Location.objects.create(name='Standort A')
        self.field = Field.objects.create(name='Feld A', location=self.location, area_sqm=200)
        self.bed = Bed.objects.create(name='Beet A', field=self.field, area_sqm=30)

    def test_centimeters_field_conversion(self):
        field = CentimetersField()
        self.assertEqual(field.to_representation(0.25), 25.0)
        self.assertIsNone(field.to_representation(None))
        self.assertEqual(field.to_internal_value('15'), 0.15)

    def test_culture_serializer_creates_supplier_from_supplier_name(self):
        serializer = CultureSerializer(
            data={
                'name': 'Salat',
                'variety': 'Lollo Rosso',
                'growth_duration_days': 6,
                'harvest_duration_days': 2,
                'harvest_method': 'per_sqm',
                'supplier_name': '  ACME Seeds GmbH ',
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        culture = serializer.save()

        self.assertIsNotNone(culture.supplier)
        self.assertEqual(culture.supplier.name_normalized, 'acme seeds')
        self.assertEqual(Supplier.objects.count(), 1)


    def test_culture_serializer_allows_harvest_duration_without_harvest_method(self):
        serializer = CultureSerializer(
            data={
                'name': 'Kohl',
                'variety': 'Türkis',
                'growth_duration_days': 90,
                'harvest_duration_days': 21,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)



    def test_planting_plan_serializer_rejects_invalid_area_input(self):
        serializer = PlantingPlanSerializer()

        with self.assertRaises(serializers.ValidationError):
            serializer.validate({'area_input_value': Decimal('0'), 'area_input_unit': 'M2'})

        with self.assertRaises(serializers.ValidationError):
            serializer.validate({'area_input_value': Decimal('10')})

    def test_planting_plan_serializer_converts_plants_to_area_and_computes_count(self):
        culture = Culture.objects.create(
            name='Möhre',
            growth_duration_days=8,
            harvest_duration_days=3,
            distance_within_row_m=0.2,
            row_spacing_m=0.5,
        )

        serializer = PlantingPlanSerializer()
        attrs = serializer.validate(
            {
                'culture': culture,
                'bed': self.bed,
                'planting_date': date(2024, 4, 1),
                'area_input_value': Decimal('100'),
                'area_input_unit': 'PLANTS',
            }
        )

        self.assertIn('area_usage_sqm', attrs)
        self.assertGreater(attrs['area_usage_sqm'], 0)

        plan = PlantingPlan.objects.create(
            culture=culture,
            bed=self.bed,
            planting_date=date(2024, 4, 1),
            area_usage_sqm=attrs['area_usage_sqm'],
        )
        self.assertIsNotNone(serializer.get_plants_count(plan))
