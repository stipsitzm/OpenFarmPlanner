# Generated migration to remove germination_rate and safety_margin fields

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0009_remove_culture_distance_within_row_cm_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='culture',
            name='germination_rate',
        ),
        migrations.RemoveField(
            model_name='culture',
            name='safety_margin',
        ),
    ]
