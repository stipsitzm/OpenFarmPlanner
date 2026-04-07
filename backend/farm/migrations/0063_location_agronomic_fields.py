from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0062_alter_field_options_alter_bed_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='location',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='location',
            name='exposure',
            field=models.CharField(
                blank=True,
                choices=[('north', 'North'), ('south', 'South'), ('east', 'East'), ('west', 'West'), ('flat', 'Flat')],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='location',
            name='soil_type',
            field=models.CharField(
                blank=True,
                choices=[('sand', 'Sand'), ('loam', 'Loam'), ('clay', 'Clay')],
                max_length=20,
                null=True,
            ),
        ),
    ]
