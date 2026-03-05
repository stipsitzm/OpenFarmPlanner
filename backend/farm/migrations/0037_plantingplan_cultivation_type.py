from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0036_culture_cultivation_types_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='plantingplan',
            name='cultivation_type',
            field=models.CharField(
                blank=True,
                choices=[('pre_cultivation', 'Pre-cultivation'), ('direct_sowing', 'Direct Sowing')],
                help_text='Cultivation type used for this plan',
                max_length=30,
            ),
        ),
    ]
