from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("farm", "0072_backfill_culture_revisions"),
    ]

    operations = [
        migrations.DeleteModel(
            name="EnrichmentAccountingRun",
        ),
    ]
