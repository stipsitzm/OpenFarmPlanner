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
    supplier_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        source='supplier',
        write_only=True,
        required=False,
        allow_null=True,
        help_text='Supplier ID (alternative to supplier_name)'
    )
    supplier_name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text='Supplier name for get-or-create (alternative to supplier_id)'
    )

    seed_rate_value = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Seed rate value (per m², per meter, or per plant, depending on unit)'
    )
    seed_rate_unit = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Unit for seed rate (e.g. 'g/m²', 'seeds/m', 'seeds_per_plant')"
    )
    sowing_calculation_safety_percent = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Safety margin for seeding calculation in percent (0-100)'
    )
    thousand_kernel_weight_g = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Weight of 1000 kernels in grams'
    )
    package_size_g = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text='Package size in grams'
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
    plants_per_m2 = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
        help_text='Calculated plants per square meter based on spacing (read-only)'
    )
    
    class Meta:
        model = Culture
        fields = '__all__'
    

    def validate_seed_rate_unit(self, value):
        """Normalize legacy seed rate unit values and validate supported units."""
        if value is None or value == '':
            return value
        
        if value == 'pcs_per_plant':
            return 'seeds_per_plant'

        allowed_values = {'g_per_m2', 'seeds/m', 'seeds_per_plant'}
        if value not in allowed_values:
            raise serializers.ValidationError('Unsupported seed rate unit.')
        return value
    def validate_growth_duration_days(self, value):
        if value is not None and value < 0:
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
        
        # Validate required fields for new and updated cultures
        if not self.instance:
            # Creating new culture - require name, variety, and supplier
            variety = attrs.get('variety', '').strip()
            if not variety:
                errors['variety'] = 'Variety is required.'
            if not attrs.get('supplier'):
                errors['supplier'] = 'Supplier is required.'
        else:
            # Updating existing culture - check if fields are being cleared
            if 'variety' in attrs:
                variety = (attrs.get('variety') or '').strip()
                if not variety:
                    errors['variety'] = 'Variety is required.'
            if 'supplier' in attrs and not attrs.get('supplier'):
                errors['supplier'] = 'Supplier is required.'
        
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
    plants_count = serializers.SerializerMethodField(read_only=True)
    
    # Write-only fields for area input
    area_input_value = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        write_only=True,
        required=False,
        help_text='Area value to input (m² or plant count depending on unit)'
    )
    area_input_unit = serializers.ChoiceField(
        choices=[('M2', 'm²'), ('PLANTS', 'Plants')],
        write_only=True,
        required=False,
        help_text='Unit for area input: M2 (square meters) or PLANTS (plant count)'
    )

    class Meta:
        model = PlantingPlan
        fields = '__all__'
        read_only_fields = ['harvest_date', 'harvest_end_date']
    
    def get_plants_count(self, obj):
        """Compute plant count from area and culture spacing."""
        if not obj.area_usage_sqm or not obj.culture:
            return None
        plants_per_m2 = obj.culture.plants_per_m2
        if not plants_per_m2 or plants_per_m2 <= 0:
            return None
        return round(obj.area_usage_sqm * plants_per_m2)

    def validate(self, attrs):
        from decimal import Decimal as D
        
        # Handle area input conversion
        area_input_value = attrs.pop('area_input_value', None)
        area_input_unit = attrs.pop('area_input_unit', None)
        
        # Validate area input fields
        if area_input_value is not None:
            # Value must be positive
            if area_input_value <= 0:
                raise serializers.ValidationError({
                    'area_input_value': 'Area input value must be greater than 0.'
                })
            
            # Unit is required when value is provided
            if not area_input_unit:
                raise serializers.ValidationError({
                    'area_input_unit': 'Area input unit is required when area_input_value is provided.'
                })
            
            # Get culture (could be from attrs for create, or from instance for update)
            culture = attrs.get('culture')
            if not culture and self.instance:
                culture = self.instance.culture
            
            # Convert based on unit
            if area_input_unit == 'M2':
                # Direct assignment
                attrs['area_usage_sqm'] = area_input_value
            elif area_input_unit == 'PLANTS':
                # Validate culture is present
                if not culture:
                    raise serializers.ValidationError({
                        'area_input_unit': 'Culture must be selected to input area as plant count.'
                    })
                
                # Validate culture has valid spacing
                plants_per_m2 = culture.plants_per_m2
                if plants_per_m2 is None or plants_per_m2 <= 0:
                    raise serializers.ValidationError({
                        'area_input_unit': 'Culture spacing data is missing or invalid. Cannot calculate area from plant count.'
                    })
                
                # Calculate area in m²: plants / (plants_per_m2)
                attrs['area_usage_sqm'] = area_input_value / plants_per_m2
        
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


class SeedDemandSerializer(serializers.Serializer):
    """Read-only serializer for aggregated seed demand per culture."""
    culture_id = serializers.IntegerField()
    culture_name = serializers.CharField()
    variety = serializers.CharField(allow_blank=True, allow_null=True)
    supplier = serializers.CharField(allow_blank=True, allow_null=True)
    total_grams = serializers.FloatField(allow_null=True)
    package_size_g = serializers.FloatField(allow_null=True)
    packages_needed = serializers.IntegerField(allow_null=True)
    warning = serializers.CharField(allow_null=True)
