from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0029_seedpackage_and_drop_legacy_package_size'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='seedpackage',
            name='article_number',
        ),
        migrations.RemoveField(
            model_name='seedpackage',
            name='source_url',
        ),
        migrations.RemoveField(
            model_name='seedpackage',
            name='evidence_text',
        ),
        migrations.RemoveField(
            model_name='seedpackage',
            name='last_seen_at',
        ),
    ]
