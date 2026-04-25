from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
class TestConsolidateSupplierTkgMigration:
    migrate_from = ('farm', '0064_tkg_decimal_precision')
    migrate_to = ('farm', '0065_consolidate_supplier_tkg_to_culture')

    def setup_method(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_from])
        old_apps = self.executor.loader.project_state([self.migrate_from]).apps

        project_model = old_apps.get_model('farm', 'Project')
        culture_model = old_apps.get_model('farm', 'Culture')
        supplier_model = old_apps.get_model('farm', 'Supplier')
        culture_supplier_data_model = old_apps.get_model('farm', 'CultureSupplierData')

        project = project_model.objects.create(name='TKG Consolidation Project', slug='tkg-consolidation-project')
        supplier_a = supplier_model.objects.create(
            name='Supplier A',
            name_normalized='supplier a',
            homepage_url='https://a.example',
            slug='supplier-a',
            project_id=project.id,
        )
        supplier_b = supplier_model.objects.create(
            name='Supplier B',
            name_normalized='supplier b',
            homepage_url='https://b.example',
            slug='supplier-b',
            project_id=project.id,
        )

        unified = culture_model.objects.create(name='Unified', project_id=project.id, thousand_kernel_weight_g=None)
        culture_supplier_data_model.objects.create(
            culture_id=unified.id,
            supplier_id=supplier_a.id,
            project_id=project.id,
            thousand_kernel_weight_g=3.4,
            packaging_sizes=[],
        )
        culture_supplier_data_model.objects.create(
            culture_id=unified.id,
            supplier_id=supplier_b.id,
            project_id=project.id,
            thousand_kernel_weight_g=3.4,
            packaging_sizes=[],
        )

        conflict = culture_model.objects.create(name='Conflict', project_id=project.id, thousand_kernel_weight_g=None)
        culture_supplier_data_model.objects.create(
            culture_id=conflict.id,
            supplier_id=supplier_a.id,
            project_id=project.id,
            thousand_kernel_weight_g=1.2,
            packaging_sizes=[],
        )
        culture_supplier_data_model.objects.create(
            culture_id=conflict.id,
            supplier_id=supplier_b.id,
            project_id=project.id,
            thousand_kernel_weight_g=2.2,
            packaging_sizes=[],
        )

        existing = culture_model.objects.create(name='Existing', project_id=project.id, thousand_kernel_weight_g=9.9)
        culture_supplier_data_model.objects.create(
            culture_id=existing.id,
            supplier_id=supplier_a.id,
            project_id=project.id,
            thousand_kernel_weight_g=4.5,
            packaging_sizes=[],
        )

        self.executor.loader.build_graph()
        self.executor.migrate([self.migrate_to])

    def test_migration_moves_unique_supplier_tkg_to_culture(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        culture_model = apps.get_model('farm', 'Culture')

        unified = culture_model.objects.get(name='Unified')
        assert unified.thousand_kernel_weight_g == Decimal('3.40')

    def test_migration_does_not_copy_conflicting_supplier_tkg_to_culture(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        culture_model = apps.get_model('farm', 'Culture')

        conflict = culture_model.objects.get(name='Conflict')
        assert conflict.thousand_kernel_weight_g is None

    def test_migration_does_not_overwrite_existing_culture_tkg(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        culture_model = apps.get_model('farm', 'Culture')

        existing = culture_model.objects.get(name='Existing')
        assert existing.thousand_kernel_weight_g == Decimal('9.90')

    def test_migration_clears_all_supplier_tkg_values(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        culture_supplier_data_model = apps.get_model('farm', 'CultureSupplierData')

        assert not culture_supplier_data_model.objects.exclude(thousand_kernel_weight_g__isnull=True).exists()
