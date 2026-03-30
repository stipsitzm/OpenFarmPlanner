from django.db import migrations


UNIT_MAP = {
    'seeds/m': 'seeds_per_lfm',
    'korn / lfm': 'seeds_per_lfm',
    'seeds_per_meter': 'seeds_per_lfm',
    'seeds_per_lfm': 'seeds_per_lfm',
    'seeds/m2': 'seeds_per_m2',
    'seeds/m²': 'seeds_per_m2',
    'korn / m2': 'seeds_per_m2',
    'korn / m²': 'seeds_per_m2',
    'seeds_per_m2': 'seeds_per_m2',
    'pcs_per_plant': 'seeds_per_plant',
}


def _normalize(value):
    if value is None:
        return None
    text = str(value).strip().lower()
    return UNIT_MAP.get(text, value)


def _normalize_by_cultivation(payload):
    if not isinstance(payload, dict):
        return payload, False
    changed = False
    next_payload = dict(payload)
    for key, item in next_payload.items():
        if not isinstance(item, dict):
            continue
        unit = item.get('unit')
        normalized = _normalize(unit)
        if normalized != unit:
            next_item = dict(item)
            next_item['unit'] = normalized
            next_payload[key] = next_item
            changed = True
    return next_payload, changed


def forward(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')
    PublicCulture = apps.get_model('farm', 'PublicCulture')

    for culture in Culture._base_manager.all().iterator():
        changed_fields = []
        normalized_unit = _normalize(culture.seed_rate_unit)
        if normalized_unit != culture.seed_rate_unit:
            culture.seed_rate_unit = normalized_unit
            changed_fields.append('seed_rate_unit')

        normalized_by_cultivation, changed_by_cultivation = _normalize_by_cultivation(culture.seed_rate_by_cultivation)
        if changed_by_cultivation:
            culture.seed_rate_by_cultivation = normalized_by_cultivation
            changed_fields.append('seed_rate_by_cultivation')

        if changed_fields:
            culture.save(update_fields=changed_fields)

    for public_culture in PublicCulture._base_manager.all().iterator():
        changed_fields = []
        normalized_unit = _normalize(public_culture.seed_rate_unit)
        if normalized_unit != public_culture.seed_rate_unit:
            public_culture.seed_rate_unit = normalized_unit
            changed_fields.append('seed_rate_unit')

        normalized_by_cultivation, changed_by_cultivation = _normalize_by_cultivation(public_culture.seed_rate_by_cultivation)
        if changed_by_cultivation:
            public_culture.seed_rate_by_cultivation = normalized_by_cultivation
            changed_fields.append('seed_rate_by_cultivation')

        if changed_fields:
            public_culture.save(update_fields=changed_fields)


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0054_seed_units_refactor'),
    ]

    operations = [
        migrations.RunPython(forward, migrations.RunPython.noop),
    ]
