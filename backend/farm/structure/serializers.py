"""DRF serializers for the farm structure domain (locations, fields, beds, layouts)."""

from rest_framework import serializers

from farm.common.serializer_fields import _resolve_active_project_from_serializer
from farm.models import Bed, BedLayout, Field, FieldLayout, Location

FIELD_NAME_DUPLICATE_MESSAGE = 'Eine Parzelle mit diesem Namen existiert in diesem Standort bereits.'


BED_NAME_DUPLICATE_MESSAGE = 'Ein Beet mit diesem Namen existiert in dieser Parzelle bereits.'


class LocationSerializer(serializers.ModelSerializer):
    @staticmethod
    def _parse_coordinate(value, field_name: str):
        if value in (None, ''):
            return None
        if isinstance(value, str):
            value = value.strip().replace(',', '.')
            if value == '':
                return None
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise serializers.ValidationError({field_name: f'{field_name.capitalize()} must be a valid number.'}) from exc

    def to_internal_value(self, data):
        payload = data.copy() if isinstance(data, dict) else data
        if isinstance(payload, dict):
            if 'latitude' in payload:
                payload['latitude'] = self._parse_coordinate(payload.get('latitude'), 'latitude')
            if 'longitude' in payload:
                payload['longitude'] = self._parse_coordinate(payload.get('longitude'), 'longitude')
        return super().to_internal_value(payload)

    def validate_latitude(self, value):
        if value is None:
            return value
        if not (-90 <= value <= 90):
            raise serializers.ValidationError('Latitude must be between -90 and 90.')
        return value

    def validate_longitude(self, value):
        if value is None:
            return value
        if not (-180 <= value <= 180):
            raise serializers.ValidationError('Longitude must be between -180 and 180.')
        return value

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Location
        fields = '__all__'
        # Server-assigned from the active project on create; never client-settable
        # (prevents cross-tenant record reassignment via update).
        read_only_fields = ['project']


class FieldSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Field
        fields = '__all__'
        validators = []
        # `project` is server-assigned on create and never client-settable
        # (prevents cross-tenant record reassignment via update).
        read_only_fields = ['project']
        extra_kwargs = {
            'name': {'label': 'Parzelle'},
        }
    
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
            if value.as_tuple().exponent < -1:
                raise serializers.ValidationError('Area must have at most one decimal place for fields.')
        return value

    def validate_length_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Length must be greater than or equal to 0.')
        return value

    def validate_width_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Width must be greater than or equal to 0.')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)
        location = attrs.get('location') or getattr(self.instance, 'location', None)
        if project is not None and location is not None and location.project_id != project.id:
            raise serializers.ValidationError({'location': 'Location does not belong to the active project.'})
        name = attrs.get('name') or getattr(self.instance, 'name', None)
        if location is not None and name:
            duplicate_fields = Field.objects.filter(location=location, name=name)
            if self.instance is not None and self.instance.pk is not None:
                duplicate_fields = duplicate_fields.exclude(pk=self.instance.pk)
            if duplicate_fields.exists():
                raise serializers.ValidationError({'name': FIELD_NAME_DUPLICATE_MESSAGE})
        return attrs


class BedSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)

    def get_image_file(self, obj):
        if not obj.image_file_id:
            return None
        return {
            'id': obj.image_file_id,
            'storage_path': obj.image_file.storage_path,
        }

    class Meta:
        model = Bed
        fields = '__all__'
        validators = []
        # `project` is server-assigned on create and never client-settable
        # (prevents cross-tenant record reassignment via update).
        read_only_fields = ['project']
        extra_kwargs = {
            'field': {'label': 'Parzelle'},
        }

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
            if value.as_tuple().exponent < -1:
                raise serializers.ValidationError('Area must have at most one decimal place for beds.')
        return value

    def validate_length_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Length must be greater than or equal to 0.')
        return value

    def validate_width_m(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Width must be greater than or equal to 0.')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)
        field = attrs.get('field') or getattr(self.instance, 'field', None)
        if project is not None and field is not None and field.project_id != project.id:
            raise serializers.ValidationError({'field': 'Field does not belong to the active project.'})
        name = attrs.get('name') or getattr(self.instance, 'name', None)
        if field is not None and name:
            duplicate_beds = Bed.objects.filter(field=field, name=name)
            if self.instance is not None and self.instance.pk is not None:
                duplicate_beds = duplicate_beds.exclude(pk=self.instance.pk)
            if duplicate_beds.exists():
                raise serializers.ValidationError({'name': BED_NAME_DUPLICATE_MESSAGE})
        return attrs


class FieldLayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = FieldLayout
        fields = [
            'id',
            'field',
            'location',
            'x',
            'y',
            'version',
            'scale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        field = attrs.get('field') or getattr(self.instance, 'field', None)
        location = attrs.get('location') or getattr(self.instance, 'location', None)
        if field and location and field.location_id != location.id:
            raise serializers.ValidationError('Layout location must match the field location.')
        return attrs


class BedLayoutSerializer(serializers.ModelSerializer):
    field_id = serializers.IntegerField(source='bed.field_id', read_only=True)

    class Meta:
        model = BedLayout
        fields = [
            'id',
            'bed',
            'location',
            'field_id',
            'x',
            'y',
            'version',
            'scale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'field_id', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        bed = attrs.get('bed') or getattr(self.instance, 'bed', None)
        location = attrs.get('location') or getattr(self.instance, 'location', None)
        if bed and location and bed.field.location_id != location.id:
            raise serializers.ValidationError('Layout location must match the bed location.')
        return attrs
