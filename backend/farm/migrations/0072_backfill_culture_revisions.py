# Generated manually: backfill existing CultureRevision rows into EntityRevision
# so per-culture history stays visible after the cutover to the generic revision model.

from django.db import migrations


def format_culture_display_name(name, variety):
    normalized_name = (name or '').strip()
    normalized_variety = (variety or '').strip()
    if normalized_name and normalized_variety:
        return f'{normalized_name} ({normalized_variety})'
    if normalized_name:
        return normalized_name
    if normalized_variety:
        return normalized_variety
    return ''


def backfill_entity_revisions(apps, schema_editor):
    CultureRevision = apps.get_model('farm', 'CultureRevision')
    EntityRevision = apps.get_model('farm', 'EntityRevision')

    rows = []
    for revision in CultureRevision.objects.select_related('culture').iterator():
        snapshot = revision.snapshot if isinstance(revision.snapshot, dict) else {}
        changed_fields = revision.changed_fields if isinstance(revision.changed_fields, list) else []
        action = 'created' if 'created' in changed_fields else 'updated'
        rows.append(EntityRevision(
            project_id=revision.culture.project_id,
            entity_type='culture',
            object_id=revision.culture_id,
            action=action,
            display_name=format_culture_display_name(snapshot.get('name'), snapshot.get('variety')),
            snapshot=snapshot,
            changed_fields=changed_fields,
            created_at=revision.created_at,
            user_name=revision.user_name or '',
        ))

    if rows:
        EntityRevision.objects.bulk_create(rows, batch_size=500)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0071_entity_revision'),
    ]

    operations = [
        migrations.RunPython(backfill_entity_revisions, noop_reverse),
    ]
