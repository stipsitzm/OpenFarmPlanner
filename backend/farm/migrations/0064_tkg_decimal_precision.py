from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0063_location_agronomic_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='culture',
            name='thousand_kernel_weight_g',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True, help_text='Weight of 1000 kernels in grams'),
        ),
        migrations.AlterField(
            model_name='culturesupplierdata',
            name='thousand_kernel_weight_g',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AlterField(
            model_name='publicculture',
            name='thousand_kernel_weight_g',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
    ]
