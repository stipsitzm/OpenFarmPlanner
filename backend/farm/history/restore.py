"""Whole-project point-in-time restore built on recorded entity revisions."""

from typing import Any

from django.db import transaction

from farm.models import EntityRevision, Project

from .records import _RESTORABLE_ENTITY_TYPES


def _entity_states_at(project: Project, entity_type: str, target_time) -> dict[int, dict[str, Any] | None]:
    """Return {object_id: snapshot} for every object with a revision at/before
    target_time; a value of None marks an object that was deleted by then."""
    revisions = (
        EntityRevision.objects
        .filter(project=project, entity_type=entity_type, created_at__lte=target_time)
        .order_by('object_id', '-created_at')
    )
    states: dict[int, dict[str, Any] | None] = {}
    for revision in revisions:
        if revision.object_id in states:
            continue
        states[revision.object_id] = None if revision.action == EntityRevision.ACTION_DELETED else revision.snapshot
    return states


def _restore_project_state_at(project: Project, target_time) -> None:
    """Reconstruct every restorable entity type to its state at target_time."""
    with transaction.atomic():
        for model, _entity_type in reversed(_RESTORABLE_ENTITY_TYPES):
            manager = getattr(model, 'all_objects', None) or model._base_manager
            manager.filter(project=project).delete()

        for model, entity_type in _RESTORABLE_ENTITY_TYPES:
            allowed_fields = {field.attname for field in model._meta.concrete_fields}
            states = _entity_states_at(project, entity_type, target_time)
            rows = []
            for snapshot in states.values():
                if snapshot is None:
                    continue
                # Old snapshots may carry fields since renamed/removed from the model
                # (schema changes don't rewrite historical JSON) — drop anything the
                # current model no longer has instead of crashing on an unknown kwarg.
                row_data = {key: value for key, value in snapshot.items() if key in allowed_fields}
                row_data['project_id'] = project.id
                rows.append(model(**row_data))
            if rows:
                model.objects.bulk_create(rows)
