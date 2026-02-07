"""DRF serializers for the farm app API."""

from django.core.exceptions import ValidationError
from rest_framework import serializers
from .models import Location, Field, Bed, Culture, PlantingPlan, Task, Supplier


class CentimetersField(serializers.FloatField):
    """Expose meter-based model fields as centimeters in the API."""
    
    def to_representation(self, value):
        if value is None:
            return None
        return float(value) * 100.0
    
    def to_internal_value(self, data):
        cm_value = super().to_internal_value(data)
        return cm_value / 100.0



class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    created = serializers.BooleanField(read_only=True, default=False)
    
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'created_at', 'updated_at', 'created']
        read_only_fields = ['created_at', 'updated_at']


class FieldSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)

    class Meta:
        model = Field
        fields = '__all__'
    
    def validate_area_sqm(self, value):
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
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = Bed
        fields = '__all__'
    
    def validate_area_sqm(self, value):
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
    """Serializer for culture data with unit conversion and supplier helpers."""
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
        if value is None:
            raise serializers.ValidationError('Growth duration is required.')
        if value < 0:
            raise serializers.ValidationError('Growth duration must be non-negative.')
        return value
    
    def validate_harvest_duration_days(self, value):
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError('Harvest duration must be non-negative.')
        return value
    
    def validate_germination_rate(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError('Germination rate must be between 0 and 100.')
        return value
    
    def validate_safety_margin(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError('Safety margin must be between 0 and 100.')
        return value
    
    def validate(self, attrs):
        """Validate cross-field rules and supplier get-or-create."""
        errors = {}
        
        # Handle supplier_name via get-or-create to keep imports ergonomic.
        supplier_name = attrs.pop('supplier_name', None)
        if supplier_name and not attrs.get('supplier'):
            from .utils import normalize_supplier_name
            supplier, created = Supplier.objects.get_or_create(
                name_normalized=normalize_supplier_name(supplier_name) or '',
                defaults={'name': supplier_name}
            )
            attrs['supplier'] = supplier
        
        if not self.instance:
            if 'growth_duration_days' not in attrs or attrs.get('growth_duration_days') is None:
                errors['growth_duration_days'] = 'Growth duration is required.'
        else:
            if 'growth_duration_days' in attrs and attrs.get('growth_duration_days') is None:
                errors['growth_duration_days'] = 'Growth duration is required.'
        
        if errors:
            raise serializers.ValidationError(errors)
        
        try:
            if self.instance:
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
            
            # Validate without mutating the real instance.
            temp_instance.clean()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict)
        
        return attrs


class PlantingPlanSerializer(serializers.ModelSerializer):
    culture_name = serializers.CharField(source='culture.name', read_only=True)
    bed_name = serializers.CharField(source='bed.name', read_only=True)

    class Meta:
        model = PlantingPlan
        fields = '__all__'
        read_only_fields = ['harvest_date', 'harvest_end_date']

    def validate(self, attrs):
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
    planting_plan_name = serializers.CharField(source='planting_plan.__str__', read_only=True)

    class Meta:
        model = Task
        fields = '__all__'


class CultureImportPreviewItemSerializer(serializers.Serializer):
    """Preview result for a single culture import item."""
    status = serializers.ChoiceField(
        choices=['create', 'update_candidate'],
        help_text='Whether this culture would be created or matches an existing one'
    )
    matched_culture_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='ID of matched culture (only for update_candidate status)'
    )
    diff = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text='List of fields that would change (only for update_candidate)'
    )
    import_data = serializers.DictField(
        help_text='The culture data that would be imported'
    )


class CultureImportApplySummarySerializer(serializers.Serializer):
    """Summary of a culture import apply operation."""
    created_count = serializers.IntegerField(help_text='Number of cultures created')
    updated_count = serializers.IntegerField(help_text='Number of cultures updated')
    skipped_count = serializers.IntegerField(help_text='Number of cultures skipped')
    errors = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of errors encountered during import'
    )
