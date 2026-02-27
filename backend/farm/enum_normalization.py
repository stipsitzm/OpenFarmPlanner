from __future__ import annotations


def normalize_seed_rate_unit(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None

    mapping = {
        'g_per_m2': 'g_per_m2',
        'g/m²': 'g_per_m2',
        'g/m2': 'g_per_m2',
        'g per m²': 'g_per_m2',
        'g per m2': 'g_per_m2',
        'gramm pro quadratmeter': 'g_per_m2',
        'gramm pro m²': 'g_per_m2',
        'gramm pro m2': 'g_per_m2',
        'gramm je quadratmeter': 'g_per_m2',
        'gramm pro 100 quadratmeter': 'g_per_m2',
        'g pro 100 m²': 'g_per_m2',
        'g pro 100 m2': 'g_per_m2',
        'seeds/m': 'seeds/m',
        'seeds per meter': 'seeds/m',
        'seeds per metre': 'seeds/m',
        'korn / lfm': 'seeds/m',
        'seeds_per_plant': 'seeds_per_plant',
        'seeds per plant': 'seeds_per_plant',
        'pcs_per_plant': 'seeds_per_plant',
        'korn / pflanze': 'seeds_per_plant',
        'g per plant': 'seeds_per_plant',
    }
    return mapping.get(text)


def normalize_choice_value(field_name: str, value: object) -> object:
    text = str(value).strip().lower()
    if field_name == 'cultivation_type':
        mapping = {
            'direct_sowing': 'direct_sowing',
            'direct sowing': 'direct_sowing',
            'direktsaat': 'direct_sowing',
            'sowing direct': 'direct_sowing',
            'pre_cultivation': 'pre_cultivation',
            'pre cultivation': 'pre_cultivation',
            'anzucht': 'pre_cultivation',
            'transplant': 'pre_cultivation',
            'transplanting': 'pre_cultivation',
            'bush bean': 'direct_sowing',
            'buschbohne': 'direct_sowing',
        }
        return mapping.get(text, text)

    if field_name == 'nutrient_demand':
        mapping = {
            'low': 'low',
            'niedrig': 'low',
            'medium': 'medium',
            'mittel': 'medium',
            'high': 'high',
            'hoch': 'high',
        }
        return mapping.get(text, text)

    if field_name == 'harvest_method':
        mapping = {
            'per_plant': 'per_plant',
            'per plant': 'per_plant',
            'pflanze': 'per_plant',
            'pro pflanze': 'per_plant',
            'per_sqm': 'per_sqm',
            'per sqm': 'per_sqm',
            'per m2': 'per_sqm',
            'pro m2': 'per_sqm',
            'pro m²': 'per_sqm',
            'per square meter': 'per_sqm',
        }
        return mapping.get(text, text)

    if field_name == 'seed_rate_unit':
        return normalize_seed_rate_unit(text) or text

    return value
