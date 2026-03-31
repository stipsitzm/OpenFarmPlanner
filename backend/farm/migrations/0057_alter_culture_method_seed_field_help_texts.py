from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0056_culture_method_specific_seed_rates'),
    ]

    operations = [
        migrations.AlterField(
            model_name='culture',
            name='seed_rate_direct_value',
            field=models.FloatField(blank=True, help_text='Seed rate for direct sowing', null=True),
        ),
        migrations.AlterField(
            model_name='culture',
            name='seed_rate_direct_unit',
            field=models.CharField(blank=True, help_text='Unit for direct sowing seed rate', max_length=30, null=True),
        ),
        migrations.AlterField(
            model_name='culture',
            name='sowing_calculation_safety_percent_direct',
            field=models.FloatField(blank=True, help_text='Safety margin for direct sowing in percent (0-100)', null=True),
        ),
        migrations.AlterField(
            model_name='culture',
            name='seed_rate_pre_cultivation_value',
            field=models.FloatField(blank=True, help_text='Seed rate for pre-cultivation/transplanting', null=True),
        ),
        migrations.AlterField(
            model_name='culture',
            name='seed_rate_pre_cultivation_unit',
            field=models.CharField(blank=True, help_text='Unit for pre-cultivation/transplanting seed rate', max_length=30, null=True),
        ),
        migrations.AlterField(
            model_name='culture',
            name='sowing_calculation_safety_percent_pre_cultivation',
            field=models.FloatField(blank=True, help_text='Safety margin for pre-cultivation/transplanting in percent (0-100)', null=True),
        ),
    ]
