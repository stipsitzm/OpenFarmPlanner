from __future__ import annotations

from django.conf import settings
from django.db import models


class PendingActivation(models.Model):
    """Stores activation expiry metadata for users that are not active yet."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pending_activation',
    )
    activation_expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        """
        Return a readable representation for admin/debug output.

        :return: String containing email/username and expiry timestamp.
        """
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'{identifier} (expires: {self.activation_expires_at.isoformat()})'
