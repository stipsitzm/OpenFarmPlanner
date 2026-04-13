from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AccountDeletionRequest
from farm.models import Project, ProjectMembership

User = get_user_model()


class Command(BaseCommand):
    """Finalize scheduled account deletions by anonymizing personal data."""

    help = 'Finalize pending account deletions whose grace period has expired.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--force',
            action='store_true',
            help='Finalize deletions even if projects would become orphaned (projects will be deactivated).',
        )

    def handle(self, *args: tuple[str, ...], **options: Any) -> None:
        """
        Anonymize accounts whose deletion schedule has expired.

        :param args: Positional command arguments.
        :param options: Parsed command options.
        :return: None.
        """
        now = timezone.now()
        force = bool(options.get('force'))
        queryset = AccountDeletionRequest.objects.select_related('user').filter(
            deleted_at__isnull=True,
            scheduled_deletion_at__isnull=False,
            scheduled_deletion_at__lte=now,
        )

        processed = 0
        skipped = 0
        orphaned_projects_total = 0
        for deletion in queryset.iterator():
            user: User = deletion.user
            memberships = list(
                ProjectMembership.objects.select_related('project').filter(
                    user=user,
                    project__is_active=True,
                ),
            )
            orphaned_project_ids: list[int] = []
            for membership in memberships:
                has_other_active_members = ProjectMembership.objects.filter(
                    project_id=membership.project_id,
                    project__is_active=True,
                    user__is_active=True,
                ).exclude(user=user).exists()
                if not has_other_active_members:
                    orphaned_project_ids.append(membership.project_id)

            if orphaned_project_ids and not force:
                skipped += 1
                orphaned_names = list(
                    Project.objects.filter(id__in=orphaned_project_ids).values_list('name', flat=True),
                )
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped user {user.pk}: deleting now would orphan projects {orphaned_names}. "
                        f"Use --force to deactivate those projects and finalize deletion.",
                    ),
                )
                continue

            if memberships:
                ProjectMembership.objects.filter(user=user).delete()
            if orphaned_project_ids:
                Project.objects.filter(id__in=orphaned_project_ids).update(is_active=False)
                orphaned_projects_total += len(set(orphaned_project_ids))
                self.stdout.write(
                    self.style.WARNING(
                        f"Deactivated orphaned projects for deleted user {user.pk}: {orphaned_project_ids}",
                    ),
                )

            anonymized_email = f'deleted-user-{user.pk}@deleted.local'
            if user.email != anonymized_email or user.is_active:
                user.email = anonymized_email
                user.first_name = ''
                user.last_name = ''
                user.is_active = False
                user.set_unusable_password()
                user.save(update_fields=['email', 'first_name', 'last_name', 'is_active', 'password'])

            deletion.deleted_at = now
            deletion.save(update_fields=['deleted_at', 'updated_at'])
            processed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Finalized {processed} accounts. Skipped {skipped}. Deactivated {orphaned_projects_total} orphaned projects.',
            ),
        )
