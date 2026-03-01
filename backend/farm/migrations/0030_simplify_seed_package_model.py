from django.db import migrations


class Migration(migrations.Migration):
    """
    Placeholder migration – the actual column removal is handled in 0031.

    This file was originally created with RemoveField operations, but because an
    instance of this migration may already be marked as applied in production
    databases (with the columns still present), we keep it as a no-op so that
    the migration graph remains stable.  Migration 0031 uses RunSQL with
    IF EXISTS to idempotently drop the columns.
    """

    dependencies = [
        ('farm', '0029_seedpackage_and_drop_legacy_package_size'),
    ]

    operations = []
