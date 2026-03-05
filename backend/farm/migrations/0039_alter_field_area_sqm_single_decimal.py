from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0038_alter_bed_area_sqm_single_decimal'),
    ]

    operations = [
        migrations.AlterField(
            model_name='field',
            name='area_sqm',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=10, null=True),
        ),
    ]
