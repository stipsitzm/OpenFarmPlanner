from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0053_alter_agentlogintoken_expires_at'),
    ]

    operations = [
        migrations.AlterModelManagers(
            name='culture',
            managers=[
                ('objects', models.Manager()),
                ('all_objects', models.Manager()),
            ],
        ),
    ]
