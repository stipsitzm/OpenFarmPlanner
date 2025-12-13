"""Serializers for the farm app API.

This module provides DRF serializers for converting model instances
to and from JSON representations for the API endpoints.
"""

from django.core.exceptions import ValidationError
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
    
    def validate_area_sqm(self, value):
        """Validate that area_sqm is within realistic bounds.
        
        :param value: The area value to validate
        :return: The validated area value
        :raises serializers.ValidationError: If area is outside bounds
        """
        if value is not None:
            if value < Field.MIN_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must be at least {Field.MIN_AREA_SQM} sqm.'
                )
            if value > Field.MAX_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must not exceed {Field.MAX_AREA_SQM} sqm (100 hectares).'
                )
        return value


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
    
    def validate_area_sqm(self, value):
        """Validate that area_sqm is within realistic bounds.
        
        :param value: The area value to validate
        :return: The validated area value
        :raises serializers.ValidationError: If area is outside bounds
        """
        if value is not None:
            if value < Bed.MIN_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must be at least {Bed.MIN_AREA_SQM} sqm.'
                )
            if value > Bed.MAX_AREA_SQM:
                raise serializers.ValidationError(
                    f'Area must not exceed {Bed.MAX_AREA_SQM} sqm (1 hectare).'
                )
        return value


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

    def validate(self, attrs):
        """Validate the planting plan data.
        
        Creates a temporary instance to run model-level validation,
        particularly for area usage validation.
        
        Args:
            attrs: Dictionary of attributes for the planting plan
            
        Returns:
            The validated attributes
            
        Raises:
            serializers.ValidationError: If validation fails
        """
        # Only run clean() validation if we have valid foreign keys
        # DRF converts the IDs to objects during validation
        culture = attrs.get('culture')
        bed = attrs.get('bed')
        
        # Skip model validation if foreign keys are not properly set
        if not culture or not bed:
            return attrs
            
        # Create a temporary instance for validation
        instance = PlantingPlan(**attrs)
        if self.instance:
            instance.pk = self.instance.pk
        
        try:
            instance.clean()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict)
        
        return attrs


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

