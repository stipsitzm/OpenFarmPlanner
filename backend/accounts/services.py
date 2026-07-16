from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from accounts.models import AccountDeletionRequest, PublicProfile
from farm.models import Project, ProjectMembership

User = get_user_model()


@dataclass(frozen=True)
class FinalizedAccountDeletion:
    """Result of finalizing one scheduled account deletion."""

    deleted_project_count: int


def finalize_account_deletion(
    *,
    deletion: AccountDeletionRequest,
    finalized_at: datetime | None = None,
) -> FinalizedAccountDeletion:
    """Anonymize a scheduled account and delete projects left without members.

    :param deletion: Scheduled deletion request to finalize.
    :param finalized_at: Timestamp to store as final deletion time.
    :return: Counts for follow-up reporting.
    """
    finalized_at = finalized_at or timezone.now()

    with transaction.atomic():
        locked_deletion = (
            AccountDeletionRequest.objects.select_for_update()
            .select_related('user')
            .get(pk=deletion.pk)
        )
        if locked_deletion.deleted_at is not None:
            return FinalizedAccountDeletion(deleted_project_count=0)

        user: User = locked_deletion.user
        project_ids = list(ProjectMembership.objects.filter(user=user).values_list('project_id', flat=True))

        anonymized_email = f'deleted-user-{user.pk}@deleted.local'
        user.email = anonymized_email
        user.first_name = ''
        user.last_name = ''
        user.is_active = False
        user.set_unusable_password()
        user.save(update_fields=['email', 'first_name', 'last_name', 'is_active', 'password'])
        PublicProfile.objects.filter(user=user).update(public_display_name='')

        ProjectMembership.objects.filter(user=user).delete()
        _ensure_remaining_projects_have_admin(project_ids=project_ids)

        deleted_project_count = 0
        if project_ids:
            orphaned_projects = Project.objects.filter(id__in=project_ids).annotate(
                member_count=Count('memberships'),
            ).filter(member_count=0)
            deleted_project_count = orphaned_projects.count()
            orphaned_projects.delete()

        locked_deletion.deleted_at = finalized_at
        locked_deletion.save(update_fields=['deleted_at', 'updated_at'])

    return FinalizedAccountDeletion(deleted_project_count=deleted_project_count)


def _ensure_remaining_projects_have_admin(*, project_ids: list[int]) -> None:
    """Promote one remaining member when account deletion removed the last admin."""
    if not project_ids:
        return

    remaining_project_ids = set(
        ProjectMembership.objects.filter(project_id__in=project_ids)
        .values_list('project_id', flat=True)
        .distinct()
    )
    admin_project_ids = set(
        ProjectMembership.objects.filter(
            project_id__in=remaining_project_ids,
            role=ProjectMembership.ROLE_ADMIN,
        ).values_list('project_id', flat=True)
    )

    for project_id in sorted(remaining_project_ids - admin_project_ids):
        membership = (
            ProjectMembership.objects.filter(project_id=project_id)
            .order_by('created_at', 'id')
            .first()
        )
        if membership is None:
            continue
        membership.role = ProjectMembership.ROLE_ADMIN
        membership.save(update_fields=['role'])
