"""Note image attachments."""


from django.conf import settings
from django.db import models

from farm.models import note_attachment_upload_path

from .planning import PlantingPlan
from .projects import Project


class NoteAttachment(models.Model):
    """Image attachment linked to a planting plan note."""

    planting_plan = models.ForeignKey(
        PlantingPlan,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    image = models.FileField(upload_to=note_attachment_upload_path)
    caption = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_note_attachments',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_note_attachments',
    )
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='note_attachments')

    class Meta:
        ordering = ['-created_at']
