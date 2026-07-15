from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_documentconsent_privacy_choice'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documentconsent',
            name='document',
            field=models.CharField(
                choices=[
                    ('terms', 'Terms of Service'),
                    ('privacy', 'Privacy Policy'),
                    ('public_library_terms', 'Public Library Contribution Terms'),
                ],
                default='terms',
                max_length=32,
            ),
        ),
    ]
