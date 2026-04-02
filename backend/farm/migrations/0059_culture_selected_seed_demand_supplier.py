from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0058_culturesupplierdata'),
    ]

    operations = [
        migrations.AddField(
            model_name='culture',
            name='selected_seed_demand_supplier',
            field=models.ForeignKey(
                blank=True,
                help_text='Persisted supplier selection for seed-demand package calculations',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='seed_demand_cultures',
                to='farm.supplier',
            ),
        ),
    ]
