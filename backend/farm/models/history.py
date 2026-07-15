"""Entity revision history models (current + deprecated drain-only)."""


from django.db import models

from .projects import Project


class CultureRevision(models.Model):
    """Deprecated: superseded by EntityRevision. Retained only so existing rows
    can drain via the cleanup_history command; no new rows are written here."""

    culture = models.ForeignKey('Culture', on_delete=models.CASCADE, related_name='revisions')
    snapshot = models.JSONField()
    changed_fields = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    user_name = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ['-created_at']


class ProjectRevision(models.Model):
    """Deprecated: superseded by EntityRevision. Retained only so existing rows
    can drain via the cleanup_history command; no new rows are written here."""

    snapshot = models.JSONField()
    summary = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='project_revisions')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', '-created_at']),
        ]


class EntityRevision(models.Model):
    """Per-entity snapshot recorded on every create/update/delete/restore.

    Replaces the old ProjectRevision (full-project JSON dump per mutation) and
    CultureRevision (per-culture only) with one generic, per-entity-sized
    record. A revision's `snapshot` holds the full field dict of the single
    entity at that point in time (not the whole project), so write cost scales
    with entity size instead of project size. Point-in-time project restore is
    reconstructed by taking, for every (entity_type, object_id), the latest
    revision at or before the target time.
    """

    ACTION_CREATED = 'created'
    ACTION_UPDATED = 'updated'
    ACTION_DELETED = 'deleted'
    ACTION_RESTORED = 'restored'
    ACTION_CHOICES = [
        (ACTION_CREATED, 'Created'),
        (ACTION_UPDATED, 'Updated'),
        (ACTION_DELETED, 'Deleted'),
        (ACTION_RESTORED, 'Restored'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='entity_revisions')
    entity_type = models.CharField(max_length=32)
    object_id = models.PositiveIntegerField()
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    display_name = models.CharField(max_length=255, blank=True)
    snapshot = models.JSONField()
    changed_fields = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user_name = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', '-created_at']),
            models.Index(fields=['project', 'entity_type', 'object_id', '-created_at']),
        ]
