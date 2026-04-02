from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0057_alter_culture_method_seed_field_help_texts'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='demo_owner',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='owned_demo_projects', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='project',
            name='is_demo_copy',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='project',
            name='is_demo_template',
            field=models.BooleanField(default=False),
        ),
    ]
