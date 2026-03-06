from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0041_bedlayout'),
    ]

    operations = [
        migrations.CreateModel(
            name='FieldLayout',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('x', models.FloatField(default=0.0)),
                ('y', models.FloatField(default=0.0)),
                ('version', models.PositiveIntegerField(default=1)),
                ('scale', models.FloatField(blank=True, null=True)),
                ('field', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='layout', to='farm.field')),
                ('location', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='field_layouts', to='farm.location')),
            ],
            options={
                'ordering': ['location', 'field'],
            },
        ),
    ]
