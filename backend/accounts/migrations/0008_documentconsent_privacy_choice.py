from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_publicprofile_unique_public_display_name_ci'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documentconsent',
            name='document',
            field=models.CharField(
                choices=[
                    ('terms', 'Terms of Service'),
                    ('privacy', 'Privacy Policy'),
                ],
                default='terms',
                max_length=32,
            ),
        ),
    ]
