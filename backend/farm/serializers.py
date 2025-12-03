"""Serializers for the farm app API.

This module provides DRF serializers for converting model instances
to and from JSON representations for the API endpoints.
"""

from rest_framework import serializers
from .models import Location, Field, Bed, Culture, PlantingPlan, Task


class LocationSerializer(serializers.ModelSerializer):
    """Serializer for the Location model.
    
    Converts Location instances to/from JSON for API responses.
    Includes all fields from the Location model.
    
    Attributes:
        Meta: Configuration class specifying model and fields
    """
    class Meta:
        model = Location
        fields = '__all__'


class FieldSerializer(serializers.ModelSerializer):
    """Serializer for the Field model.
    
    Converts Field instances to/from JSON for API responses.
    Includes all fields plus a read-only location_name field.
    
    Attributes:
        location_name: Read-only field showing the parent location's name
        Meta: Configuration class specifying model and fields
    """
    location_name = serializers.CharField(source='location.name', read_only=True)

    class Meta:
        model = Field
        fields = '__all__'


class BedSerializer(serializers.ModelSerializer):
    """Serializer for the Bed model.
    
    Converts Bed instances to/from JSON for API responses.
    Includes all fields plus a read-only field_name field.
    
    Attributes:
        field_name: Read-only field showing the parent field's name
        Meta: Configuration class specifying model and fields
    """
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = Bed
        fields = '__all__'


class CultureSerializer(serializers.ModelSerializer):
    """Serializer for the Culture model.
    
    Converts Culture instances to/from JSON for API responses.
    Includes all fields from the Culture model.
    
    Attributes:
        Meta: Configuration class specifying model and fields
    """
    class Meta:
        model = Culture
        fields = '__all__'


class PlantingPlanSerializer(serializers.ModelSerializer):
    """Serializer for the PlantingPlan model.
    
    Converts PlantingPlan instances to/from JSON for API responses.
    Includes all fields plus read-only fields for culture and bed names.
    The harvest_date field is read-only as it's auto-calculated.
    
    Attributes:
        culture_name: Read-only field showing the culture's name
        bed_name: Read-only field showing the bed's name
        Meta: Configuration class specifying model and fields
    """
    culture_name = serializers.CharField(source='culture.name', read_only=True)
    bed_name = serializers.CharField(source='bed.name', read_only=True)

    class Meta:
        model = PlantingPlan
        fields = '__all__'
        read_only_fields = ['harvest_date']


class TaskSerializer(serializers.ModelSerializer):
    """Serializer for the Task model.
    
    Converts Task instances to/from JSON for API responses.
    Includes all fields plus a read-only planting_plan_name field.
    
    Attributes:
        planting_plan_name: Read-only field showing the planting plan's string representation
        Meta: Configuration class specifying model and fields
    """
    planting_plan_name = serializers.CharField(source='planting_plan.__str__', read_only=True)

    class Meta:
        model = Task
        fields = '__all__'

