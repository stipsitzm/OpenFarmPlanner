from django.db import migrations, models


DIRECT = 'direct_sowing'
PRE = 'pre_cultivation'


def _extract_rate(method_payload):
    if not isinstance(method_payload, dict):
        return None, None
    value = method_payload.get('value')
    unit = method_payload.get('unit')
    return value, unit


def forwards(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')

    for culture in Culture.objects.all().iterator():
        by_method = culture.seed_rate_by_cultivation if isinstance(culture.seed_rate_by_cultivation, dict) else {}
        cultivation_types = culture.cultivation_types if isinstance(culture.cultivation_types, list) else []

        direct_value, direct_unit = _extract_rate(by_method.get(DIRECT))
        pre_value, pre_unit = _extract_rate(by_method.get(PRE))

        if direct_value is None and direct_unit is None and DIRECT in cultivation_types:
            direct_value = culture.seed_rate_value
            direct_unit = culture.seed_rate_unit

        if pre_value is None and pre_unit is None and PRE in cultivation_types:
            pre_value = culture.seed_rate_value
            pre_unit = culture.seed_rate_unit

        if not cultivation_types:
            pre_value = pre_value if pre_value is not None else culture.seed_rate_value
            pre_unit = pre_unit if pre_unit else culture.seed_rate_unit

        culture.seed_rate_direct_value = direct_value
        culture.seed_rate_direct_unit = direct_unit
        culture.seed_rate_pre_cultivation_value = pre_value
        culture.seed_rate_pre_cultivation_unit = pre_unit

        if DIRECT in cultivation_types:
            culture.sowing_calculation_safety_percent_direct = culture.sowing_calculation_safety_percent
        if PRE in cultivation_types or not cultivation_types:
            culture.sowing_calculation_safety_percent_pre_cultivation = culture.sowing_calculation_safety_percent

        culture.save(
            update_fields=[
                'seed_rate_direct_value',
                'seed_rate_direct_unit',
                'seed_rate_pre_cultivation_value',
                'seed_rate_pre_cultivation_unit',
                'sowing_calculation_safety_percent_direct',
                'sowing_calculation_safety_percent_pre_cultivation',
            ]
        )


def backwards(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')

    for culture in Culture.objects.all().iterator():
        value = culture.seed_rate_pre_cultivation_value
        unit = culture.seed_rate_pre_cultivation_unit

        if value is None or not unit:
            value = culture.seed_rate_direct_value
            unit = culture.seed_rate_direct_unit

        culture.seed_rate_value = value
        culture.seed_rate_unit = unit

        if culture.sowing_calculation_safety_percent_pre_cultivation is not None:
            culture.sowing_calculation_safety_percent = culture.sowing_calculation_safety_percent_pre_cultivation
        elif culture.sowing_calculation_safety_percent_direct is not None:
            culture.sowing_calculation_safety_percent = culture.sowing_calculation_safety_percent_direct

        culture.save(update_fields=['seed_rate_value', 'seed_rate_unit', 'sowing_calculation_safety_percent'])


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0055_reapply_seed_unit_normalization'),
    ]

    operations = [
        migrations.AddField(
            model_name='culture',
            name='seed_rate_direct_unit',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='culture',
            name='seed_rate_direct_value',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='culture',
            name='seed_rate_pre_cultivation_unit',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='culture',
            name='seed_rate_pre_cultivation_value',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='culture',
            name='sowing_calculation_safety_percent_direct',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='culture',
            name='sowing_calculation_safety_percent_pre_cultivation',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.RunPython(forwards, backwards),
    ]
