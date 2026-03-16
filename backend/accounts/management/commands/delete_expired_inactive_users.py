from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    """Delete users that stayed inactive past their activation deadline."""

    help = 'Delete inactive users whose activation deadline has expired.'

    def handle(self, *args: tuple[str, ...], **options: Any) -> None:
        """
        Delete inactive users with expired activation windows.

        :param args: Positional command arguments.
        :param options: Parsed command options.
        :return: None.
        """
        now = timezone.now()
        queryset = User.objects.filter(
            is_active=False,
            pending_activation__activation_expires_at__lt=now,
        )

        found_count = queryset.count()
        self.stdout.write(f'Found {found_count} expired inactive users.')

        deleted_count = 0
        for user in queryset.iterator():
            # Inactive users in this flow are not yet activated and are expected to have no productive data.
            user.delete()
            deleted_count += 1

        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted_count} expired inactive users.'))
