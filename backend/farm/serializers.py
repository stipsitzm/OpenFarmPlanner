from rest_framework import serializers
from .models import Location, Field, Bed, Culture, PlantingPlan, Task


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'


class FieldSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)

    class Meta:
        model = Field
        fields = '__all__'


class BedSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = Bed
        fields = '__all__'


class CultureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Culture
        fields = '__all__'


class PlantingPlanSerializer(serializers.ModelSerializer):
    culture_name = serializers.CharField(source='culture.name', read_only=True)
    bed_name = serializers.CharField(source='bed.name', read_only=True)

    class Meta:
        model = PlantingPlan
        fields = '__all__'
        read_only_fields = ['harvest_date']


class TaskSerializer(serializers.ModelSerializer):
    planting_plan_name = serializers.CharField(source='planting_plan.__str__', read_only=True)

    class Meta:
        model = Task
        fields = '__all__'
