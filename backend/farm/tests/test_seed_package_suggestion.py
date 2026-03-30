from decimal import Decimal

from farm.services.seed_packages import PackageOption, compute_seed_package_suggestion


def _selection_dict(result) -> dict[Decimal, int]:
    return {item.size_value: item.count for item in result.selection}


def test_seed_package_suggestion_prefers_two_large_packs_over_many_small_packs():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('15.4'),
        packages=[
            PackageOption(size_value=Decimal('10'), size_unit='g'),
            PackageOption(size_value=Decimal('2'), size_unit='g'),
        ],
        unit='g',
    )
    assert result.total_amount == Decimal('20')
    assert result.pack_count == 2
    assert _selection_dict(result) == {Decimal('10'): 2}


def test_seed_package_suggestion_for_11g_uses_small_pack_as_fine_tuning():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('11'),
        packages=[
            PackageOption(size_value=Decimal('10'), size_unit='g'),
            PackageOption(size_value=Decimal('2'), size_unit='g'),
        ],
        unit='g',
    )
    assert result.total_amount == Decimal('12')
    assert result.pack_count == 2
    assert _selection_dict(result) == {Decimal('10'): 1, Decimal('2'): 1}


def test_seed_package_suggestion_for_9g_prefers_single_large_pack():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('9'),
        packages=[
            PackageOption(size_value=Decimal('10'), size_unit='g'),
            PackageOption(size_value=Decimal('2'), size_unit='g'),
        ],
        unit='g',
    )
    assert result.total_amount == Decimal('10')
    assert result.pack_count == 1
    assert _selection_dict(result) == {Decimal('10'): 1}


def test_seed_package_suggestion_exact_match_with_single_size():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('25'),
        packages=[PackageOption(size_value=Decimal('25'), size_unit='g')],
        unit='g',
    )
    assert result.total_amount == Decimal('25')
    assert result.overage == Decimal('0')
    assert result.pack_count == 1
    assert _selection_dict(result) == {Decimal('25'): 1}


def test_seed_package_suggestion_prefers_fewer_distinct_sizes_when_pack_count_is_equal():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('18'),
        packages=[
            PackageOption(size_value=Decimal('12'), size_unit='g'),
            PackageOption(size_value=Decimal('9'), size_unit='g'),
            PackageOption(size_value=Decimal('6'), size_unit='g'),
        ],
        unit='g',
    )
    assert result.total_amount == Decimal('18')
    assert result.pack_count == 2
    assert _selection_dict(result) == {Decimal('9'): 2}


def test_seed_package_suggestion_with_only_one_available_size():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('37'),
        packages=[PackageOption(size_value=Decimal('10'), size_unit='g')],
        unit='g',
    )
    assert result.total_amount == Decimal('40')
    assert result.pack_count == 4
    assert _selection_dict(result) == {Decimal('10'): 4}


def test_seed_package_suggestion_handles_zero_required_amount():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('0'),
        packages=[PackageOption(size_value=Decimal('10'), size_unit='g')],
        unit='g',
    )
    assert result.selection == []
    assert result.total_amount == Decimal('0')
    assert result.pack_count == 0


def test_seed_package_suggestion_handles_empty_package_options():
    result = compute_seed_package_suggestion(
        required_amount=Decimal('10'),
        packages=[],
        unit='g',
    )
    assert result.selection == []
    assert result.total_amount == Decimal('0')
    assert result.pack_count == 0
