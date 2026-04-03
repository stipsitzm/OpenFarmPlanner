from copy import deepcopy

from django.db import migrations


def _normalize_legacy_seed_packages(seed_packages):
    if not isinstance(seed_packages, list):
        return []

    normalized = []
    for entry in seed_packages:
        if not isinstance(entry, dict):
            continue
        size_value = entry.get('size_value')
        size_unit = entry.get('size_unit')
        if size_value is None or size_unit not in {'g', 'seeds'}:
            continue
        normalized.append(
            {
                'size_value': float(size_value),
                'size_unit': size_unit,
            }
        )
    return normalized


def copy_legacy_culture_seed_fields(apps, schema_editor):
    culture_model = apps.get_model('farm', 'Culture')
    culture_supplier_data_model = apps.get_model('farm', 'CultureSupplierData')
    seed_package_model = apps.get_model('farm', 'SeedPackage')

    for culture in culture_model.objects.all().iterator():
        supplier_rows = list(culture_supplier_data_model.objects.filter(culture_id=culture.id))
        if len(supplier_rows) != 1:
            continue

        supplier_row = supplier_rows[0]
        should_save = False

        if supplier_row.thousand_kernel_weight_g is None and culture.thousand_kernel_weight_g is not None:
            supplier_row.thousand_kernel_weight_g = culture.thousand_kernel_weight_g
            should_save = True

        if not supplier_row.packaging_sizes:
            legacy_seed_packages = seed_package_model.objects.filter(culture_id=culture.id).values('size_value', 'size_unit')
            normalized_legacy_packages = _normalize_legacy_seed_packages(list(legacy_seed_packages))
            if normalized_legacy_packages:
                supplier_row.packaging_sizes = deepcopy(normalized_legacy_packages)
                should_save = True

        if should_save:
            supplier_row.save(update_fields=['thousand_kernel_weight_g', 'packaging_sizes', 'updated_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0059_culture_selected_seed_demand_supplier'),
    ]

    operations = [
        migrations.RunPython(copy_legacy_culture_seed_fields, migrations.RunPython.noop),
    ]
