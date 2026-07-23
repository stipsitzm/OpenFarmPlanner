from __future__ import annotations

from typing import Any

from django.db import models


class CropSpecies(models.Model):
    """Official language-independent species used at the publishing boundary."""

    STATUS_PUBLISHED = 'published'
    STATUS_PROPOSED = 'proposed'
    STATUS_CHOICES = [
        (STATUS_PUBLISHED, 'Published'),
        (STATUS_PROPOSED, 'Proposed'),
    ]

    name = models.CharField(max_length=200)
    name_normalized = models.CharField(max_length=200, db_index=True, editable=False, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PUBLISHED)

    class Meta:
        ordering = ['name']
        verbose_name = 'Crop species'
        verbose_name_plural = 'Crop species'

    def save(self, *args: Any, **kwargs: Any) -> None:
        from farm.utils import normalize_text

        self.name_normalized = normalize_text(self.name) or ''
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
