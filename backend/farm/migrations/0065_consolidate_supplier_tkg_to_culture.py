from django.db import migrations


def consolidate_supplier_tkg_to_culture(apps, schema_editor):
    culture_model = apps.get_model('farm', 'Culture')
    culture_supplier_data_model = apps.get_model('farm', 'CultureSupplierData')

    for culture in culture_model.objects.all().iterator():
        supplier_rows = culture_supplier_data_model.objects.filter(culture_id=culture.id)
        supplier_tkgs = [row.thousand_kernel_weight_g for row in supplier_rows if row.thousand_kernel_weight_g is not None]

        if culture.thousand_kernel_weight_g is None and supplier_tkgs:
            distinct_values = set(supplier_tkgs)
            if len(distinct_values) == 1:
                culture.thousand_kernel_weight_g = supplier_tkgs[0]
                culture.save(update_fields=['thousand_kernel_weight_g', 'updated_at'])

        supplier_rows.exclude(thousand_kernel_weight_g__isnull=True).update(thousand_kernel_weight_g=None)


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0064_tkg_decimal_precision'),
    ]

    operations = [
        migrations.RunPython(consolidate_supplier_tkg_to_culture, migrations.RunPython.noop),
    ]
