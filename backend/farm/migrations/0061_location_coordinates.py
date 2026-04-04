from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0060_backfill_supplier_data_from_culture_seed_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='location',
            name='latitude',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='location',
            name='longitude',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
