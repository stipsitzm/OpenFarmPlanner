from django.db import migrations
from django.utils.text import slugify


INITIAL_PROJECT_NAME = 'Gelawi Zwiebelzopf'
INITIAL_PROJECT_SLUG = 'gelawi-zwiebelzopf'


def forward(apps, schema_editor):
    Project = apps.get_model('farm', 'Project')
    Membership = apps.get_model('farm', 'ProjectMembership')
    Supplier = apps.get_model('farm', 'Supplier')
    Location = apps.get_model('farm', 'Location')
    Field = apps.get_model('farm', 'Field')
    Bed = apps.get_model('farm', 'Bed')
    BedLayout = apps.get_model('farm', 'BedLayout')
    FieldLayout = apps.get_model('farm', 'FieldLayout')
    Culture = apps.get_model('farm', 'Culture')
    SeedPackage = apps.get_model('farm', 'SeedPackage')
    PlantingPlan = apps.get_model('farm', 'PlantingPlan')
    Task = apps.get_model('farm', 'Task')
    NoteAttachment = apps.get_model('farm', 'NoteAttachment')
    ProjectRevision = apps.get_model('farm', 'ProjectRevision')
    User = apps.get_model('auth', 'User')
    UserProjectSettings = apps.get_model('accounts', 'UserProjectSettings')

    project, _ = Project.objects.get_or_create(
        slug=INITIAL_PROJECT_SLUG,
        defaults={'name': INITIAL_PROJECT_NAME, 'description': '', 'is_active': True},
    )

    for user in User.objects.all():
        Membership.objects.get_or_create(user=user, project=project, defaults={'role': 'admin'})
        settings_obj, _ = UserProjectSettings.objects.get_or_create(user=user)
        if settings_obj.default_project_id is None:
            settings_obj.default_project_id = project.id
        if settings_obj.last_project_id is None:
            settings_obj.last_project_id = project.id
        settings_obj.save()

    models_to_update = [
        Supplier,
        Location,
        Field,
        Bed,
        BedLayout,
        FieldLayout,
        Culture,
        SeedPackage,
        PlantingPlan,
        Task,
        NoteAttachment,
        ProjectRevision,
    ]
    for model in models_to_update:
        model.objects.filter(project__isnull=True).update(project=project)


def backward(apps, schema_editor):
    Project = apps.get_model('farm', 'Project')
    Project.objects.filter(slug=INITIAL_PROJECT_SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_userprojectsettings'),
        ('farm', '0046_project_alter_supplier_name_and_more'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
