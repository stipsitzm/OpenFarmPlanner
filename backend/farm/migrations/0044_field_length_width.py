from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0043_bed_length_width'),
    ]

    operations = [
        migrations.AddField(
            model_name='field',
            name='length_m',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='width_m',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
