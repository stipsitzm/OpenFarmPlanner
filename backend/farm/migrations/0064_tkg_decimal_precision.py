from django.db import migrations, models


def migrate_supplier_tkg_to_culture(apps, schema_editor):
    culture_model = apps.get_model('farm', 'Culture')
    culture_supplier_data_model = apps.get_model('farm', 'CultureSupplierData')

    for culture in culture_model.objects.all().iterator():
        if culture.thousand_kernel_weight_g is not None:
            continue

        supplier_tkgs = list(
            culture_supplier_data_model.objects
            .filter(culture_id=culture.id, thousand_kernel_weight_g__isnull=False)
            .values_list('thousand_kernel_weight_g', flat=True)
        )
        if not supplier_tkgs:
            continue

        distinct_values = set(supplier_tkgs)
        if len(distinct_values) != 1:
            # Intentionally skip ambiguous cultures where supplier rows carry
            # different TKG values. No automatic "best guess" should be written.
            continue

        culture.thousand_kernel_weight_g = supplier_tkgs[0]
        culture.save(update_fields=['thousand_kernel_weight_g', 'updated_at'])


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
        migrations.RunPython(migrate_supplier_tkg_to_culture, migrations.RunPython.noop),
    ]
