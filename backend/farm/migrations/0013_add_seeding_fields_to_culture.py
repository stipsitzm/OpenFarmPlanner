from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ("farm", "0012_culture_seed_supplier"),
    ]

    operations = [
        migrations.AddField(
            model_name="culture",
            name="seed_rate_value",
            field=models.FloatField(null=True, blank=True, help_text="Seed rate value (per m² or per 100m, depending on unit)"),
        ),
        migrations.AddField(
            model_name="culture",
            name="seed_rate_unit",
            field=models.CharField(max_length=30, blank=True, help_text="Unit for seed rate (e.g. 'g/m²', 'seeds/m²', 'g/100m', etc.)"),
        ),
        migrations.AddField(
            model_name="culture",
            name="sowing_calculation_safety_percent",
            field=models.FloatField(null=True, blank=True, help_text="Safety margin for seeding calculation in percent (0-100)"),
        ),
        migrations.AddField(
            model_name="culture",
            name="seeding_requirement",
            field=models.FloatField(null=True, blank=True, help_text="Total seeding requirement (g or seeds, depending on type)"),
        ),
        migrations.AddField(
            model_name="culture",
            name="seeding_requirement_type",
            field=models.CharField(max_length=30, blank=True, help_text="Type of seeding requirement (e.g. 'g', 'seeds')"),
        ),
    ]
