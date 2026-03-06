from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0042_fieldlayout'),
    ]

    operations = [
        migrations.AddField(
            model_name='bed',
            name='length_m',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bed',
            name='width_m',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
