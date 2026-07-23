"""Serializer for the public culture library."""

from typing import Any

from rest_framework import serializers

from farm.models import (
    PublicCulture,
    PublicCultureChangeProposal,
    PublicCultureDiscussionComment,
)

PUBLIC_CULTURE_PROPOSABLE_FIELDS = {
    'notes',
    'seed_supplier',
    'supplier_name',
    'crop_family',
    'nutrient_demand',
    'cultivation_type',
    'cultivation_types',
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
    'seed_packages',
}


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


class PublicCultureChangeProposalSerializer(serializers.ModelSerializer):
    proposed_by_label = serializers.SerializerMethodField()
    reviewed_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCultureChangeProposal
        fields = [
            'id',
            'public_culture',
            'summary',
            'proposed_data',
            'status',
            'proposed_by_label',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'public_culture',
            'status',
            'proposed_by_label',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]

    def validate_proposed_data(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError('Proposed data must be an object.')
        unknown_fields = sorted(set(value) - PUBLIC_CULTURE_PROPOSABLE_FIELDS)
        if unknown_fields:
            raise serializers.ValidationError(f"Unsupported proposal fields: {', '.join(unknown_fields)}")
        if not value:
            raise serializers.ValidationError('At least one changed field is required.')
        return value

    def get_proposed_by_label(self, obj: PublicCultureChangeProposal) -> str:
        return self._get_user_label(obj.proposed_by)

    def get_reviewed_by_label(self, obj: PublicCultureChangeProposal) -> str:
        return self._get_user_label(obj.reviewed_by)

    @staticmethod
    def _get_user_label(user: Any) -> str:
        if user is None:
            return ''
        public_profile = getattr(user, 'public_profile', None)
        if public_profile and public_profile.public_display_name:
            return public_profile.public_display_name
        return ''
