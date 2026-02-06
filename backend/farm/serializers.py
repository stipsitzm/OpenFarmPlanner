"""Serializers for the farm app API.

This module provides DRF serializers for converting model instances
to and from JSON representations for the API endpoints.
"""

from django.core.exceptions import ValidationError
from rest_framework import serializers
from .models import Location, Field, Bed, Culture, PlantingPlan, Task, Supplier


class CentimetersField(serializers.FloatField):
    """Custom field that converts between meters (DB) and centimeters (API).
    
    Internally, the database stores spacing values in meters (SI units).
    However, the API exposes these values in centimeters for user convenience.
    
    This field handles the conversion:
    - On serialization (DB -> API): meters * 100 = centimeters
    - On deserialization (API -> DB): centimeters / 100 = meters
    """
    
    def to_representation(self, value):
        """Convert from meters (DB) to centimeters (API) for output.
        
        Args:
            value: Value in meters (float or None)
            
        Returns:
            Value in centimeters (float or None)
        """
        if value is None:
            return None
        return float(value) * 100.0
    
    def to_internal_value(self, data):
        """Convert from centimeters (API) to meters (DB) for input.
        
        Args:
            data: Value in centimeters (from API)
            
        Returns:
            Value in meters (float)
        """
        # First validate as a float using parent class
        cm_value = super().to_internal_value(data)
        # Convert to meters for internal storage
        return cm_value / 100.0



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


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer for the Supplier model.
    
    Converts Supplier instances to/from JSON for API responses.
    Includes id, name, and created flag for get-or-create operations.
    
    Attributes:
        created: Read-only flag indicating if supplier was newly created
        Meta: Configuration class specifying model and fields
    """
    created = serializers.BooleanField(read_only=True, default=False)
    
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'created_at', 'updated_at', 'created']
        read_only_fields = ['created_at', 'updated_at']


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
    
    Note on units:
    - Spacing fields are stored internally in meters (SI units)
    - API exposes these fields in centimeters for user convenience
    - Conversion is handled automatically by CentimetersField
    
    Supplier handling:
    - Read: supplier field returns { id, name } or null
    - Write: accepts supplier_id (FK) or supplier_name (get-or-create)
    
    Attributes:
        distance_within_row_cm: Distance within row in cm (API), stored as meters internally
        row_spacing_cm: Row spacing in cm (API), stored as meters internally
        sowing_depth_cm: Sowing depth in cm (API), stored as meters internally
        supplier: Nested supplier object for read operations
        supplier_name: Write-only field for creating/getting supplier by name
        Meta: Configuration class specifying model and fields
    """
    # Use custom field to convert between meters (internal) and centimeters (API)
    distance_within_row_cm = CentimetersField(
        source='distance_within_row_m',
        required=False,
        allow_null=True,
        help_text='Distance within row in centimeters'
    )
    row_spacing_cm = CentimetersField(
        source='row_spacing_m',
        required=False,
        allow_null=True,
        help_text='Row spacing in centimeters'
    )
    sowing_depth_cm = CentimetersField(
        source='sowing_depth_m',
        required=False,
        allow_null=True,
        help_text='Sowing depth in centimeters'
    )
    
    # Supplier fields - nested for read, write-only name field for convenience
    supplier = SupplierSerializer(read_only=True)
    supplier_name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        help_text='Supplier name for get-or-create (alternative to supplier_id)'
    )

    seed_rate_value = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Seed rate value (per m² or per 100m, depending on unit)'
    )
    seed_rate_unit = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Unit for seed rate (e.g. 'g/m²', 'seeds/m²', 'g/100m', etc.)"
    )
    sowing_calculation_safety_percent = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Safety margin for seeding calculation in percent (0-100)'
    )
    seeding_requirement = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Total seeding requirement (g or seeds, depending on type)'
    )
    seeding_requirement_type = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Type of seeding requirement (e.g. 'g', 'seeds')"
    )
    
    class Meta:
        model = Culture
        fields = '__all__'
    
    def validate_growth_duration_days(self, value):
        """Validate growth duration is required and non-negative.
        
        :param value: The growth duration value to validate
        :return: The validated value
        :raises serializers.ValidationError: If validation fails
        """
        if value is None:
            raise serializers.ValidationError('Growth duration is required.')
        if value < 0:
            raise serializers.ValidationError('Growth duration must be non-negative.')
        return value
    
    def validate_harvest_duration_days(self, value):
        """Validate harvest duration is required and non-negative.
        
        :param value: The harvest duration value to validate
        :return: The validated value
        :raises serializers.ValidationError: If validation fails
        """
        if value is None:
            raise serializers.ValidationError('Harvest duration is required.')
        if value < 0:
            raise serializers.ValidationError('Harvest duration must be non-negative.')
        return value
    
    def validate_germination_rate(self, value):
        """Validate germination rate is between 0 and 100.
        
        :param value: The germination rate to validate
        :return: The validated value
        :raises serializers.ValidationError: If validation fails
        """
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError('Germination rate must be between 0 and 100.')
        return value
    
    def validate_safety_margin(self, value):
        """Validate safety margin is between 0 and 100.
        
        :param value: The safety margin to validate
        :return: The validated value
        :raises serializers.ValidationError: If validation fails
        """
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError('Safety margin must be between 0 and 100.')
        return value
    
    def validate(self, attrs):
        """Validate the culture data.
        
        Runs model-level validation via clean() method and checks required fields.
        Handles supplier_name to get-or-create Supplier instance.
        
        :param attrs: Dictionary of attributes for the culture
        :return: The validated attributes
        :raises serializers.ValidationError: If validation fails
        """
        errors = {}
        
        # Handle supplier_name if provided (get-or-create Supplier)
        supplier_name = attrs.pop('supplier_name', None)
        if supplier_name and not attrs.get('supplier'):
            from .utils import normalize_supplier_name
            # Get or create supplier by name
            supplier, created = Supplier.objects.get_or_create(
                name_normalized=normalize_supplier_name(supplier_name) or '',
                defaults={'name': supplier_name}
            )
            attrs['supplier'] = supplier
        
        # Check required fields for create operations
        if not self.instance:
            if 'growth_duration_days' not in attrs or attrs.get('growth_duration_days') is None:
                errors['growth_duration_days'] = 'Growth duration is required.'
            if 'harvest_duration_days' not in attrs or attrs.get('harvest_duration_days') is None:
                errors['harvest_duration_days'] = 'Harvest duration is required.'
        else:
            # For updates, only validate if field is being set to None
            if 'growth_duration_days' in attrs and attrs.get('growth_duration_days') is None:
                errors['growth_duration_days'] = 'Growth duration is required.'
            if 'harvest_duration_days' in attrs and attrs.get('harvest_duration_days') is None:
                errors['harvest_duration_days'] = 'Harvest duration is required.'
        
        if errors:
            raise serializers.ValidationError(errors)
        
        # For model-level validation, we just need to validate the attrs themselves
        # The model's clean() will be called when saving
        # We create a temporary instance just for validation
        try:
            if self.instance:
                # Don't modify the actual instance, just validate the new data
                temp_attrs = {}
                for field in Culture._meta.fields:
                    field_name = field.name
                    if field_name in attrs:
                        temp_attrs[field_name] = attrs[field_name]
                    elif hasattr(self.instance, field_name):
                        temp_attrs[field_name] = getattr(self.instance, field_name)
                temp_instance = Culture(**temp_attrs)
                temp_instance.pk = self.instance.pk
            else:
                temp_instance = Culture(**attrs)
            
            temp_instance.clean()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict)
        
        return attrs


class PlantingPlanSerializer(serializers.ModelSerializer):
    """Serializer for the PlantingPlan model.
    
    Converts PlantingPlan instances to/from JSON for API responses.
    Includes all fields plus read-only fields for culture and bed names.
    The harvest_date and harvest_end_date fields are read-only as they're auto-calculated.
    
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
        read_only_fields = ['harvest_date', 'harvest_end_date']

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
