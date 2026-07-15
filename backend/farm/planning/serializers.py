"""DRF serializers for the planning domain (planting plans and tasks)."""

from django.core.exceptions import ValidationError
from rest_framework import serializers

from farm.common.serializer_fields import (
    AuditUserSerializer,
    _resolve_active_project_from_serializer,
)
from farm.models import PlantingPlan, Task


class PlantingPlanSerializer(serializers.ModelSerializer):
    culture_name = serializers.CharField(source='culture.name', read_only=True)
    culture_variety = serializers.CharField(source='culture.variety', read_only=True, allow_blank=True)
    culture_display_color = serializers.CharField(source='culture.display_color', read_only=True, allow_blank=True)
    culture_propagation_duration_days = serializers.IntegerField(source='culture.propagation_duration_days', read_only=True, allow_null=True)
    culture_cultivation_type = serializers.CharField(source='culture.cultivation_type', read_only=True, allow_blank=True)
    culture_cultivation_types = serializers.ListField(source='culture.cultivation_types', child=serializers.CharField(), read_only=True)
    bed_name = serializers.CharField(source='bed.name', read_only=True)
    plants_count = serializers.SerializerMethodField(read_only=True)
    note_attachment_count = serializers.IntegerField(read_only=True)
    created_by_user = AuditUserSerializer(source='created_by', read_only=True)
    updated_by_user = AuditUserSerializer(source='updated_by', read_only=True)
    
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

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = PlantingPlan
        fields = '__all__'
        read_only_fields = ['project', 'harvest_date', 'harvest_end_date', 'created_by', 'updated_by']
    
    def get_plants_count(self, obj):
        """Compute plant count from area and culture spacing."""
        if not obj.area_usage_sqm or not obj.culture:
            return None
        plants_per_m2 = obj.culture.plants_per_m2
        if not plants_per_m2 or plants_per_m2 <= 0:
            return None
        return round(obj.area_usage_sqm * plants_per_m2)

    def validate(self, attrs):
        self._validate_project_scope(attrs)
        self._apply_area_input_conversion(attrs)
        self._run_model_clean(attrs)
        return attrs

    def _validate_project_scope(self, attrs):
        """Culture and bed must belong to the active project."""
        project = _resolve_active_project_from_serializer(self)
        culture = attrs.get('culture') or (self.instance.culture if self.instance else None)
        bed = attrs.get('bed') or (self.instance.bed if self.instance else None)
        if project is not None and culture is not None and culture.project_id != project.id:
            raise serializers.ValidationError({'culture': 'Culture does not belong to the active project.'})
        if project is not None and bed is not None and bed.project_id != project.id:
            raise serializers.ValidationError({'bed': 'Bed does not belong to the active project.'})

    def _apply_area_input_conversion(self, attrs):
        """Convert the M2/PLANTS area input into area_usage_sqm on attrs."""
        area_input_value = attrs.pop('area_input_value', None)
        area_input_unit = attrs.pop('area_input_unit', None)

        if area_input_value is None:
            return

        # Value must be positive
        if area_input_value <= 0:
            raise serializers.ValidationError({
                'area_input_value': 'Area input value must be greater than 0.'
            })

        # Unit is required when value is provided
        if not area_input_unit:
            raise serializers.ValidationError({
                'area_input_unit': (
                    'Area input unit is required when '
                    'area_input_value is provided.'
                )
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
            attrs['area_usage_sqm'] = self._plants_to_area(area_input_value, culture)

    def _plants_to_area(self, plant_count, culture):
        """Convert a plant count into an area in m² using the culture's spacing."""
        # Validate culture is present
        if not culture:
            raise serializers.ValidationError({
                'area_input_unit': 'Culture must be selected to input area as plant count.'
            })

        # Validate culture has valid spacing
        plants_per_m2 = culture.plants_per_m2
        if plants_per_m2 is None or plants_per_m2 <= 0:
            raise serializers.ValidationError({
                'area_input_unit': (
                    'Culture spacing data is missing or invalid. '
                    'Cannot calculate area from plant count.'
                )
            })

        # Calculate area in m²: plants / (plants_per_m2)
        return plant_count / plants_per_m2

    def _run_model_clean(self, attrs):
        """Run PlantingPlan.clean on a throwaway instance without mutating the real one."""
        model_field_names = {field.name for field in PlantingPlan._meta.fields}
        if self.instance:
            validation_attrs = {}
            for field_name in model_field_names:
                if field_name in attrs:
                    validation_attrs[field_name] = attrs[field_name]
                elif hasattr(self.instance, field_name):
                    validation_attrs[field_name] = getattr(self.instance, field_name)
            instance = PlantingPlan(
                **{name: value for name, value in validation_attrs.items() if name in model_field_names}
            )
            instance.pk = self.instance.pk
        else:
            instance = PlantingPlan(**{name: value for name, value in attrs.items() if name in model_field_names})

        try:
            instance.clean()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict) from e


class TaskSerializer(serializers.ModelSerializer):
    planting_plan_name = serializers.CharField(source='planting_plan.__str__', read_only=True)

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Task
        fields = '__all__'

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)
        planting_plan = attrs.get('planting_plan') or getattr(self.instance, 'planting_plan', None)
        if project is not None and planting_plan is not None and planting_plan.project_id != project.id:
            raise serializers.ValidationError({'planting_plan': 'Planting plan does not belong to the active project.'})
        return attrs
