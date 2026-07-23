"""Serializer for the public culture library."""

from typing import Any

from rest_framework import serializers

from farm.models import (
    PublicCulture,
    PublicCultureDiscussionComment,
    PublicCultureVersion,
)
from farm.services.public_cultures import PUBLIC_CULTURE_EDITABLE_FIELDS


class PublicCultureSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField()
    crop_species_name = serializers.CharField(source='crop_species.name', read_only=True, default='')

    class Meta:
        model = PublicCulture
        fields = [
            'id',
            'status',
            'removal_reason',
            'name',
            'variety',
            'notes',
            'seed_supplier',
            'supplier_name',
            'crop_species',
            'crop_species_name',
            'original_language_code',
            'crop_family',
            'nutrient_demand',
            'cultivation_types',
            'cultivation_type',
            'growth_duration_days',
            'harvest_duration_days',
            'propagation_duration_days',
            'harvest_method',
            'expected_yield',
            'allow_deviation_delivery_weeks',
            'distance_within_row_m',
            'row_spacing_m',
            'sowing_depth_m',
            'seed_rate_value',
            'seed_rate_unit',
            'seed_rate_by_cultivation',
            'sowing_calculation_safety_percent',
            'thousand_kernel_weight_g',
            'seeding_requirement',
            'seeding_requirement_type',
            'display_color',
            'seed_packages',
            'version',
            'published_at',
            'created_at',
            'updated_at',
            'created_by_label',
            'source_project_culture',
            'source_project',
        ]
        read_only_fields = fields

    def get_created_by_label(self, obj: PublicCulture) -> str:
        return obj.created_by_label


class PublicCultureDiscussionCommentSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCultureDiscussionComment
        fields = [
            'id',
            'public_culture',
            'body',
            'created_by_label',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'public_culture',
            'created_by_label',
            'created_at',
            'updated_at',
        ]

    def get_created_by_label(self, obj: PublicCultureDiscussionComment) -> str:
        user = obj.created_by
        if user is None:
            return ''
        public_profile = getattr(user, 'public_profile', None)
        if public_profile and public_profile.public_display_name:
            return public_profile.public_display_name
        return ''


class PublicCultureEditSerializer(serializers.ModelSerializer):
    change_comment = serializers.CharField(max_length=240, required=False, allow_blank=True, write_only=True)

    class Meta:
        model = PublicCulture
        fields = [*PUBLIC_CULTURE_EDITABLE_FIELDS, 'change_comment']
        extra_kwargs = {
            field: {'required': False, 'allow_null': True}
            for field in PUBLIC_CULTURE_EDITABLE_FIELDS
            if field not in {'name', 'variety', 'notes', 'crop_family', 'nutrient_demand', 'cultivation_type', 'harvest_method', 'seed_rate_unit', 'seeding_requirement_type', 'display_color', 'original_language_code'}
        }

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        editable_attrs = {field: value for field, value in attrs.items() if field in PUBLIC_CULTURE_EDITABLE_FIELDS}
        if not editable_attrs:
            raise serializers.ValidationError('At least one changed field is required.')
        return attrs


class PublicCultureVersionSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCultureVersion
        fields = [
            'id',
            'public_culture',
            'version_number',
            'snapshot',
            'change_summary',
            'change_comment',
            'created_by_label',
            'created_at',
        ]
        read_only_fields = fields

    def get_created_by_label(self, obj: PublicCultureVersion) -> str:
        return obj.created_by_label
