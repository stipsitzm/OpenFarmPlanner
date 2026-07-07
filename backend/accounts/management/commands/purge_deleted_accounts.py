from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AccountDeletionRequest

User = get_user_model()


class Command(BaseCommand):
    """Finalize scheduled account deletions by anonymizing personal data."""

    help = 'Finalize pending account deletions whose grace period has expired.'

    def handle(self, *args: tuple[str, ...], **options: Any) -> None:
        """
        Anonymize accounts whose deletion schedule has expired.

        :param args: Positional command arguments.
        :param options: Parsed command options.
        :return: None.
        """
        now = timezone.now()
        queryset = AccountDeletionRequest.objects.select_related('user').filter(
            deleted_at__isnull=True,
            scheduled_deletion_at__isnull=False,
            scheduled_deletion_at__lte=now,
        )

        processed = 0
        for deletion in queryset.iterator():
            user: User = deletion.user
            anonymized_email = f'deleted-user-{user.pk}@deleted.local'
            if user.email != anonymized_email or user.is_active:
                user.email = anonymized_email
                user.first_name = ''
                user.last_name = ''
                user.is_active = False
                user.set_unusable_password()
                # TODO: `username` is intentionally left untouched here, but
                # PublicCulture.get_created_by_label() falls back to it when
                # first/last name are blank — so a deleted user's username can
                # keep showing up as the public-library attribution on their
                # published cultures indefinitely. Decide whether to also
                # anonymize `username` (breaks any remaining unique lookups by
                # username) or to null out `created_by`/store a frozen display
                # name on PublicCulture at publish time instead.
                user.save(update_fields=['email', 'first_name', 'last_name', 'is_active', 'password'])

            deletion.deleted_at = now
            deletion.save(update_fields=['deleted_at', 'updated_at'])
            processed += 1

        self.stdout.write(self.style.SUCCESS(f'Finalized {processed} accounts.'))
