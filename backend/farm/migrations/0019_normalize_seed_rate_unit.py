from django.db import migrations


def normalize_seed_rate_unit(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')
    Culture.objects.filter(seed_rate_unit='pcs_per_plant').update(seed_rate_unit='seeds_per_plant')


def noop_reverse(apps, schema_editor):
    """No-op reverse migration to avoid data rollback ambiguity."""


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0018_culture_package_size_g_and_more'),
    ]

    operations = [
        migrations.RunPython(normalize_seed_rate_unit, noop_reverse),
    ]
