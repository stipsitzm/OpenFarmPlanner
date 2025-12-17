# Generated manually on 2025-12-17 08:55

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0005_remove_bed_length_m_remove_bed_width_m_bed_area_sqm'),
    ]

    operations = [
        migrations.AddField(
            model_name='plantingplan',
            name='harvest_end_date',
            field=models.DateField(blank=True, help_text='Harvest end date (Ernteende)', null=True),
        ),
        migrations.AlterField(
            model_name='plantingplan',
            name='harvest_date',
            field=models.DateField(blank=True, help_text='Harvest start date (Erntebeginn)', null=True),
        ),
    ]
