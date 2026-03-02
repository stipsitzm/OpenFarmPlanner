from __future__ import annotations

from django.db import migrations


def backfill_supplier_fields(apps, schema_editor) -> None:
    """Backfill supplier homepage, slug, and allowed domains after schema repair.

    :param apps: Historical app registry.
    :param schema_editor: Django schema editor.
    :return: None.
    """
    Supplier = apps.get_model('farm', 'Supplier')
    for supplier in Supplier.objects.all():
        name = (supplier.name or '').strip().lower()
        if 'reinsaat' in name:
            homepage = 'https://www.reinsaat.at'
            slug = 'reinsaat'
            domains = ['reinsaat.at']
        else:
            homepage = f"https://{(name.replace(' ', '-') or 'supplier')}.example"
            slug = (name.replace(' ', '-') or 'supplier')[:180]
            domains = []

        supplier.homepage_url = homepage
        supplier.slug = slug
        supplier.allowed_domains = domains
        supplier.save(update_fields=['homepage_url', 'slug', 'allowed_domains'])


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0032_supplier_domain_fields_and_culture_product_url'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE farm_supplier
                ADD COLUMN IF NOT EXISTS allowed_domains jsonb;

            ALTER TABLE farm_supplier
                ADD COLUMN IF NOT EXISTS homepage_url varchar(200);

            ALTER TABLE farm_supplier
                ADD COLUMN IF NOT EXISTS slug varchar(200);

            ALTER TABLE farm_culture
                ADD COLUMN IF NOT EXISTS supplier_product_url varchar(200);

            ALTER TABLE farm_supplier
                ALTER COLUMN allowed_domains SET DEFAULT '[]'::jsonb;

            UPDATE farm_supplier
            SET allowed_domains = '[]'::jsonb
            WHERE allowed_domains IS NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(backfill_supplier_fields, migrations.RunPython.noop),
        migrations.RunSQL(
            sql="""
            ALTER TABLE farm_supplier
                ALTER COLUMN homepage_url SET NOT NULL;

            ALTER TABLE farm_supplier
                ALTER COLUMN slug SET NOT NULL;

            ALTER TABLE farm_supplier
                ALTER COLUMN allowed_domains SET NOT NULL;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'farm_supplier_slug_13b135c5_uniq'
                ) THEN
                    ALTER TABLE farm_supplier
                        ADD CONSTRAINT farm_supplier_slug_13b135c5_uniq UNIQUE (slug);
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'farm_supplier_name_481b90a0_uniq'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM farm_supplier
                    GROUP BY name
                    HAVING COUNT(*) > 1
                ) THEN
                    ALTER TABLE farm_supplier
                        ADD CONSTRAINT farm_supplier_name_481b90a0_uniq UNIQUE (name);
                END IF;
            END $$;

            CREATE INDEX IF NOT EXISTS farm_supplier_slug_13b135c5
                ON farm_supplier (slug);

            CREATE INDEX IF NOT EXISTS farm_supplier_slug_13b135c5_like
                ON farm_supplier (slug varchar_pattern_ops);

            CREATE INDEX IF NOT EXISTS farm_supplier_name_481b90a0_like
                ON farm_supplier (name varchar_pattern_ops);
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
