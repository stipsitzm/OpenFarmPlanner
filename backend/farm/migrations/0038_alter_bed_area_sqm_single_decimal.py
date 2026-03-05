from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0037_plantingplan_cultivation_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bed',
            name='area_sqm',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=10, null=True),
        ),
    ]
