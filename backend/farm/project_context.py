from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import exceptions
from rest_framework.request import Request

from .models import Project, ProjectMembership


PROJECT_HEADER = 'HTTP_X_PROJECT_ID'


def get_user_memberships(user) -> list[ProjectMembership]:
    """Return all project memberships for a user."""
    if not user.is_authenticated:
        return []
    return list(ProjectMembership.objects.select_related('project').filter(user=user, project__is_active=True))


def resolve_project_for_user(user) -> tuple[Project | None, bool]:
    """Resolve active project and selection need for bootstrap output."""
    memberships = get_user_memberships(user)
    if not memberships:
        return None, True
    if len(memberships) == 1:
        return memberships[0].project, False

    settings_obj = getattr(user, 'project_settings', None)
    allowed_ids = {membership.project_id for membership in memberships}

    if settings_obj and settings_obj.last_project_id in allowed_ids:
        return settings_obj.last_project, False
    if settings_obj and settings_obj.default_project_id in allowed_ids:
        return settings_obj.default_project, False
    return None, True


def get_active_project_or_400(request: Request) -> Project:
    """Resolve and validate active project from request header for authenticated users."""
    raw = request.META.get(PROJECT_HEADER)
    if not raw:
        raise exceptions.ValidationError({'project': 'Missing X-Project-Id header.'})
    try:
        project_id = int(raw)
    except (TypeError, ValueError) as exc:
        raise exceptions.ValidationError({'project': 'Invalid X-Project-Id header.'}) from exc

    membership = ProjectMembership.objects.select_related('project').filter(
        user=request.user,
        project_id=project_id,
        project__is_active=True,
    ).first()
    if membership is None:
        raise exceptions.PermissionDenied('You are not a member of this project.')
    return membership.project


def require_project_admin(user, project_id: int) -> None:
    """Raise permission denied when user is not admin in project."""
    is_admin = ProjectMembership.objects.filter(
        user=user,
        project_id=project_id,
        role=ProjectMembership.ROLE_ADMIN,
    ).exists()
    if not is_admin:
        raise exceptions.PermissionDenied('Project admin role required.')


def get_project_for_member(user, project_id: int) -> Project:
    """Return project for user membership or raise permission denied."""
    membership = get_object_or_404(ProjectMembership.objects.select_related('project'), user=user, project_id=project_id)
    return membership.project
