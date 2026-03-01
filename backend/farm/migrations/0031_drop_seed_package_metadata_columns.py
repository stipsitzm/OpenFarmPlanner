from django.db import migrations


def drop_seed_package_columns(apps, schema_editor):
    """Drop legacy metadata columns from farm_seedpackage if they still exist."""
    columns_to_drop = ('article_number', 'source_url', 'evidence_text', 'last_seen_at')
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'postgresql':
            for col in columns_to_drop:
                cursor.execute(
                    f"ALTER TABLE farm_seedpackage DROP COLUMN IF EXISTS {col};"
                )
        else:
            # SQLite (tests): inspect columns and drop only if present
            cursor.execute("PRAGMA table_info(farm_seedpackage);")
            existing = {row[1] for row in cursor.fetchall()}
            for col in columns_to_drop:
                if col in existing:
                    cursor.execute(
                        f"ALTER TABLE farm_seedpackage DROP COLUMN {col};"
                    )


class Migration(migrations.Migration):
    """Idempotently remove metadata columns from farm_seedpackage."""

    dependencies = [
        ('farm', '0030_simplify_seed_package_model'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(model_name='seedpackage', name='article_number'),
                migrations.RemoveField(model_name='seedpackage', name='source_url'),
                migrations.RemoveField(model_name='seedpackage', name='evidence_text'),
                migrations.RemoveField(model_name='seedpackage', name='last_seen_at'),
            ],
            database_operations=[
                migrations.RunPython(drop_seed_package_columns, reverse_code=migrations.RunPython.noop),
            ],
        ),
    ]
