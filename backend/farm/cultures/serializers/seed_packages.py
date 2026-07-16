"""Serializer for seed packages."""


from rest_framework import serializers

from farm.common.serializer_fields import (
    _resolve_active_project_from_serializer,
)
from farm.models import (
    SeedPackage,
)


class SeedPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeedPackage
        fields = [
            'id',
            'culture',
            'size_value',
            'size_unit',
            'evidence_text',
            'last_seen_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        validators = []
        extra_kwargs = {'culture': {'required': False}, 'size_unit': {'default': SeedPackage.UNIT_GRAMS}}






    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)

        culture = attrs.get('culture')
        if culture is None and self.instance is not None:
            culture = self.instance.culture
        size_value = attrs.get('size_value')
        size_unit = attrs.get('size_unit')

        if project is not None and culture is not None and culture.project_id != project.id:
            raise serializers.ValidationError({'culture': 'Culture does not belong to the active project.'})

        if culture is None or size_value is None or size_unit is None:
            return attrs

        existing = SeedPackage.objects.filter(
            culture=culture,
            size_value=size_value,
            size_unit=size_unit,
        )

        raw_initial_data = getattr(self, 'initial_data', None)
        incoming_id = raw_initial_data.get('id') if isinstance(raw_initial_data, dict) else None
        if incoming_id is not None:
            try:
                incoming_id = int(incoming_id)
            except (TypeError, ValueError):
                incoming_id = None

        if incoming_id is not None:
            existing = existing.exclude(pk=incoming_id)
        elif self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        elif raw_initial_data is None:
            # Nested serializer items in Culture updates do not reliably include initial_data.
            # CultureSerializer handles de-duplication before replacing packages, so skip here.
            return attrs

        if existing.exists():
            raise serializers.ValidationError('The fields culture, size_value, size_unit must make a unique set.')

        return attrs
