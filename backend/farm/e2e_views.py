from __future__ import annotations

import os
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from farm.models import Project, ProjectInvitation, ProjectMembership

User = get_user_model()
E2E_PASSWORD = 'Pass12345!'
TEST_EMAIL_DOMAIN = 'e2e.local'


def _e2e_token() -> str:
    return os.getenv('E2E_TEST_TOKEN', '').strip()


def _ensure_e2e_request(request: Request) -> None:
    configured_token = _e2e_token()
    if not getattr(settings, 'DEBUG', False) or not configured_token:
        raise PermissionDenied('E2E helpers are disabled.')
    if request.headers.get('X-E2E-Token', '') != configured_token:
        raise PermissionDenied('Invalid E2E token.')


def _scenario_slug(raw_value: str) -> str:
    cleaned = ''.join(ch if ch.isalnum() else '-' for ch in (raw_value or '').strip().lower())
    cleaned = '-'.join(part for part in cleaned.split('-') if part)
    return cleaned or uuid.uuid4().hex[:12]


def _user_email(scenario: str, role: str) -> str:
    return f'{scenario}-{role}@{TEST_EMAIL_DOMAIN}'


class E2EInvitationFixtureView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        _ensure_e2e_request(request)
        action = str(request.data.get('action', '')).strip().lower()
        scenario = _scenario_slug(str(request.data.get('scenario_id', '')))

        if action == 'reset':
            self._reset(scenario)
            return Response({'ok': True})
        if action == 'setup':
            return Response(self._setup(request, scenario))
        if action == 'remove_member':
            return Response(self._remove_member(scenario))
        if action == 'revoke_invitation':
            return Response(self._revoke_invitation(request, scenario))
        raise PermissionDenied('Unsupported E2E action.')

    def _reset(self, scenario: str) -> None:
        ProjectMembership.objects.filter(project__slug=scenario).delete()
        ProjectInvitation.objects.filter(project__slug=scenario).delete()
        Project.objects.filter(slug=scenario).delete()
        User.objects.filter(email__in=[
            _user_email(scenario, 'admin'),
            _user_email(scenario, 'invitee'),
            _user_email(scenario, 'outsider'),
        ]).delete()

    def _setup(self, request: Request, scenario: str) -> dict[str, object]:
        self._reset(scenario)
        invitation_state = str(request.data.get('invitation_state', 'pending')).strip().lower() or 'pending'
        frontend_base = settings.FRONTEND_URL.rstrip('/')
        project = Project.objects.create(name=f'E2E Project {scenario}', slug=scenario)

        admin = User.objects.create_user(
            username=f'{scenario}-admin',
            email=_user_email(scenario, 'admin'),
            password=E2E_PASSWORD,
            is_active=True,
        )
        invitee = User.objects.create_user(
            username=f'{scenario}-invitee',
            email=_user_email(scenario, 'invitee'),
            password=E2E_PASSWORD,
            is_active=True,
        )
        outsider = User.objects.create_user(
            username=f'{scenario}-outsider',
            email=_user_email(scenario, 'outsider'),
            password=E2E_PASSWORD,
            is_active=True,
        )
        ProjectMembership.objects.create(user=admin, project=project, role=ProjectMembership.ROLE_ADMIN)

        invitation = ProjectInvitation.objects.create(
            project=project,
            email=invitee.email,
            role=ProjectMembership.ROLE_MEMBER,
            token=f'{scenario}-{uuid.uuid4().hex}',
            invited_by=admin,
            expires_at=timezone.now() + timedelta(days=14),
        )
        if invitation_state == ProjectInvitation.STATUS_REVOKED:
            invitation.status = ProjectInvitation.STATUS_REVOKED
            invitation.revoked_at = timezone.now()
            invitation.revoked_by = admin
            invitation.save(update_fields=['status', 'revoked_at', 'revoked_by', 'updated_at'])
        elif invitation_state == ProjectInvitation.STATUS_ACCEPTED:
            ProjectMembership.objects.create(user=invitee, project=project, role=ProjectMembership.ROLE_MEMBER)
            invitation.status = ProjectInvitation.STATUS_ACCEPTED
            invitation.accepted_at = timezone.now()
            invitation.accepted_by = invitee
            invitation.save(update_fields=['status', 'accepted_at', 'accepted_by', 'updated_at'])

        return {
            'projectName': project.name,
            'projectSlug': project.slug,
            'inviteToken': invitation.token,
            'inviteUrl': f'{frontend_base}/invite/accept?token={invitation.token}',
            'invitee': {'email': invitee.email, 'password': E2E_PASSWORD},
            'outsider': {'email': outsider.email, 'password': E2E_PASSWORD},
            'admin': {'email': admin.email, 'password': E2E_PASSWORD},
        }

    def _remove_member(self, scenario: str) -> dict[str, object]:
        project = Project.objects.get(slug=scenario)
        invitee_email = _user_email(scenario, 'invitee')
        membership_deleted, _ = ProjectMembership.objects.filter(
            project=project,
            user__email__iexact=invitee_email,
        ).delete()
        return {'ok': True, 'removedMembershipRows': membership_deleted}

    def _revoke_invitation(self, request: Request, scenario: str) -> dict[str, object]:
        invitation = ProjectInvitation.objects.get(project__slug=scenario, token=request.data['token'])
        invitation.status = ProjectInvitation.STATUS_REVOKED
        invitation.revoked_at = timezone.now()
        invitation.save(update_fields=['status', 'revoked_at', 'updated_at'])
        return {'ok': True}
