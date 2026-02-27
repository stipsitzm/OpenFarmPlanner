from decimal import Decimal

from farm.services.seed_packages import PackageOption, compute_seed_package_suggestion


def test_seed_package_suggestion_for_37g_prefers_min_pack_count_then_overage():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('37'),
        packages=[
            PackageOption(size_value=Decimal('25'), size_unit='g'),
            PackageOption(size_value=Decimal('10'), size_unit='g'),
            PackageOption(size_value=Decimal('5'), size_unit='g'),
        ],
        unit='g',
    )
    assert result.pack_count == 3
    assert result.total_amount == Decimal('40')


def test_seed_package_suggestion_for_40g_prefers_exact_over_larger_overage():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('40'),
        packages=[
            PackageOption(size_value=Decimal('25'), size_unit='g'),
            PackageOption(size_value=Decimal('5'), size_unit='g'),
        ],
        unit='g',
    )
    assert result.total_amount == Decimal('40')
    assert result.overage == Decimal('0')
