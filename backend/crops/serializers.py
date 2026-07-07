"""
Defined independently from `farm.serializers.PublicCultureSerializer` on
purpose, even though the two are currently near-identical: this app must
depend on `farm.models` only, never on `farm.serializers` or `farm.views`
(that would put the dependency arrow backwards — see
docs/crop-library-architecture.md). The small duplication is the
deliberate cost of keeping that direction correct until `PublicCulture`
itself moves into this app.
"""
from rest_framework import serializers

from farm.models import PublicCulture


class CropSerializer(serializers.ModelSerializer):
    """Read-only representation of a published crop, for the /api/crops/ surface."""

    created_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCulture
        fields = [
            'id',
            'status',
            'name',
            'variety',
            'notes',
            'seed_supplier',
            'supplier_name',
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
        ]
        read_only_fields = fields

    def get_created_by_label(self, obj: PublicCulture) -> str:
        return obj.created_by_label
