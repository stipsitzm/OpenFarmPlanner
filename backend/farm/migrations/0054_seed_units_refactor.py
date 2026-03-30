from django.db import migrations, models


def _normalize_seed_rate_unit(value):
    if value is None:
        return None
    text = str(value).strip().lower()
    mapping = {
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
    return mapping.get(text, value)


def forward_migrate_seed_units(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')
    PublicCulture = apps.get_model('farm', 'PublicCulture')

    for culture in Culture.all_objects.all().iterator():
        changed = False
        normalized_unit = _normalize_seed_rate_unit(culture.seed_rate_unit)
        if normalized_unit != culture.seed_rate_unit:
            culture.seed_rate_unit = normalized_unit
            changed = True

        by_cultivation = culture.seed_rate_by_cultivation or None
        if isinstance(by_cultivation, dict):
            updated = False
            for payload in by_cultivation.values():
                if isinstance(payload, dict):
                    current = payload.get('unit')
                    normalized = _normalize_seed_rate_unit(current)
                    if normalized != current:
                        payload['unit'] = normalized
                        updated = True
            if updated:
                culture.seed_rate_by_cultivation = by_cultivation
                changed = True

        if changed:
            culture.save(update_fields=['seed_rate_unit', 'seed_rate_by_cultivation'])

    for public in PublicCulture.objects.all().iterator():
        changed = False
        normalized_unit = _normalize_seed_rate_unit(public.seed_rate_unit)
        if normalized_unit != public.seed_rate_unit:
            public.seed_rate_unit = normalized_unit
            changed = True
        by_cultivation = public.seed_rate_by_cultivation or None
        if isinstance(by_cultivation, dict):
            updated = False
            for payload in by_cultivation.values():
                if isinstance(payload, dict):
                    current = payload.get('unit')
                    normalized = _normalize_seed_rate_unit(current)
                    if normalized != current:
                        payload['unit'] = normalized
                        updated = True
            if updated:
                public.seed_rate_by_cultivation = by_cultivation
                changed = True
        if changed:
            public.save(update_fields=['seed_rate_unit', 'seed_rate_by_cultivation'])


def backward_migrate_seed_units(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')
    PublicCulture = apps.get_model('farm', 'PublicCulture')

    reverse_map = {
        'seeds_per_lfm': 'seeds/m',
    }

    for culture in Culture.all_objects.all().iterator():
        changed = False
        if culture.seed_rate_unit in reverse_map:
            culture.seed_rate_unit = reverse_map[culture.seed_rate_unit]
            changed = True
        by_cultivation = culture.seed_rate_by_cultivation or None
        if isinstance(by_cultivation, dict):
            updated = False
            for payload in by_cultivation.values():
                if isinstance(payload, dict) and payload.get('unit') in reverse_map:
                    payload['unit'] = reverse_map[payload['unit']]
                    updated = True
            if updated:
                culture.seed_rate_by_cultivation = by_cultivation
                changed = True
        if changed:
            culture.save(update_fields=['seed_rate_unit', 'seed_rate_by_cultivation'])

    for public in PublicCulture.objects.all().iterator():
        changed = False
        if public.seed_rate_unit in reverse_map:
            public.seed_rate_unit = reverse_map[public.seed_rate_unit]
            changed = True
        by_cultivation = public.seed_rate_by_cultivation or None
        if isinstance(by_cultivation, dict):
            updated = False
            for payload in by_cultivation.values():
                if isinstance(payload, dict) and payload.get('unit') in reverse_map:
                    payload['unit'] = reverse_map[payload['unit']]
                    updated = True
            if updated:
                public.seed_rate_by_cultivation = by_cultivation
                changed = True
        if changed:
            public.save(update_fields=['seed_rate_unit', 'seed_rate_by_cultivation'])


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0053_alter_agentlogintoken_expires_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='seedpackage',
            name='size_unit',
            field=models.CharField(choices=[('g', 'Grams'), ('seeds', 'Seeds')], default='g', max_length=10),
        ),
        migrations.RunPython(forward_migrate_seed_units, backward_migrate_seed_units),
    ]
