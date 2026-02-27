from django.db import migrations, models


def forwards(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')
    SeedPackage = apps.get_model('farm', 'SeedPackage')
    for culture in Culture.objects.exclude(package_size_g__isnull=True):
        if culture.package_size_g <= 0:
            continue
        SeedPackage.objects.get_or_create(
            culture_id=culture.id,
            size_value=culture.package_size_g,
            size_unit='g',
            defaults={'available': True},
        )


def backwards(apps, schema_editor):
    Culture = apps.get_model('farm', 'Culture')
    SeedPackage = apps.get_model('farm', 'SeedPackage')
    for culture in Culture.objects.all():
        first_package = SeedPackage.objects.filter(culture_id=culture.id, size_unit='g').order_by('size_value').first()
        if first_package:
            culture.package_size_g = first_package.size_value
            culture.save(update_fields=['package_size_g'])


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0028_enrichmentaccountingrun'),
    ]

    operations = [
        migrations.CreateModel(
            name='SeedPackage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('size_value', models.DecimalField(decimal_places=3, max_digits=10)),
                ('size_unit', models.CharField(choices=[('g', 'Grams'), ('seeds', 'Seeds')], max_length=10)),
                ('available', models.BooleanField(default=True)),
                ('article_number', models.CharField(blank=True, max_length=120)),
                ('source_url', models.URLField(blank=True)),
                ('evidence_text', models.CharField(blank=True, max_length=200)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True)),
                ('culture', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='seed_packages', to='farm.culture')),
            ],
            options={
                'ordering': ['size_unit', 'size_value'],
            },
        ),
        migrations.AddConstraint(
            model_name='seedpackage',
            constraint=models.UniqueConstraint(fields=('culture', 'size_value', 'size_unit'), name='unique_seed_package_per_culture_size_unit'),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name='culture',
            name='package_size_g',
        ),
    ]
