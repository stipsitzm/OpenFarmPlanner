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


class UserProjectSettings(models.Model):
    """Stores per-user project preferences for default and last active project."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_settings',
    )
    default_project = models.ForeignKey(
        'farm.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='default_for_users',
    )
    last_project = models.ForeignKey(
        'farm.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='last_for_users',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        """Return a human-readable identifier."""
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'Project settings for {identifier}'


class AccountDeletionRequest(models.Model):
    """Stores deferred account deletion scheduling state for a user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='account_deletion_request',
    )
    deletion_requested_at = models.DateTimeField(null=True, blank=True)
    scheduled_deletion_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_pending(self) -> bool:
        """Return whether the account is currently scheduled for deletion."""
        return self.deletion_requested_at is not None and self.deleted_at is None

    def clear_schedule(self) -> None:
        """Clear pending deletion schedule fields.

        :return: None.
        """
        self.deletion_requested_at = None
        self.scheduled_deletion_at = None
        self.save(update_fields=['deletion_requested_at', 'scheduled_deletion_at', 'updated_at'])

    def __str__(self) -> str:
        """Return human-readable account deletion state text.

        :return: String with account identifier and schedule.
        """
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'Account deletion state for {identifier}'
