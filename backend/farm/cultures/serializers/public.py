"""Serializer for the public culture library."""

from rest_framework import serializers

from farm.models import PublicCulture


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
