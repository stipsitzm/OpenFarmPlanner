"""ViewSets for the farm app API endpoints.

This module provides RESTful API endpoints for all farm models using
Django REST Framework's ModelViewSet. Each ViewSet handles CRUD operations
for its respective model.
"""

from collections import defaultdict
import logging
import time
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import json
from typing import Any

from django.conf import settings
from django.contrib.auth import login
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, OperationalError, transaction
from django.db.models import Case, When, Value, F, FloatField, IntegerField, ExpressionWrapper, Sum, CharField, Q, Count, Prefetch
from django.db.models.functions import Coalesce, Ceil, Cast
from django.http import HttpResponseBadRequest, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect
from rest_framework import viewsets, status, generics, parsers, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.files.storage import default_storage
from django.utils import timezone, translation
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from django.utils.dateparse import parse_date
from django.utils.translation import gettext as _
from .models import AgentLoginToken, Location, Field, Bed, BedLayout, FieldLayout, Culture, CultureSupplierData, PlantingPlan, Task, Supplier, NoteAttachment, MediaFile, SeedPackage, PublicCulture, culture_media_upload_path, EntityRevision, Project, ProjectMembership, ProjectInvitation, format_culture_display_name
from .project_context import get_active_project_or_400, require_project_admin, resolve_project_for_user
from .serializers import (
    LocationSerializer,
    FieldSerializer,
    BedSerializer,
    BedLayoutSerializer,
    FieldLayoutSerializer,
    CultureSerializer,
    PlantingPlanSerializer,
    TaskSerializer,
    SupplierSerializer,
    SeedDemandSerializer,
    PublicCultureSerializer,
    NoteAttachmentSerializer,
    CultureHistoryEntrySerializer,
    CultureRestoreSerializer,
    SeedPackageSerializer,
    CultureSupplierDataSerializer,
    ProjectSerializer,
    ProjectMembershipSerializer,
    ProjectInvitationSerializer,
    InvitationTokenSerializer,
    BED_NAME_DUPLICATE_MESSAGE,
    FIELD_NAME_DUPLICATE_MESSAGE,
)
from accounts.models import UserProjectSettings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from .services.project_invitations import (
    InvitationFlowError,
    accept_invitation,
    accept_pending_invitation_from_session,
    build_public_status,
    clear_pending_invitation_token,
    create_or_resend_invitation,
    get_pending_invitation_token,
    get_invitation_by_token,
    revoke_invitation,
    store_pending_invitation_token,
)

from .services_area import calculate_remaining_bed_area

from .image_processing import (
    process_note_image,
    ImageProcessingError,
    ImageProcessingBackendUnavailableError,
)
from .services.seed_packages import PackageOption, compute_seed_package_suggestion
from .seed_units import (
    SEED_PACKAGE_UNIT_GRAMS,
    SEED_PACKAGE_UNIT_SEEDS,
    SEED_RATE_UNIT_G_PER_LFM,
    SEED_RATE_UNIT_G_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_LFM,
    SEED_RATE_UNIT_SEEDS_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_PLANT,
)
from .services.public_cultures import (
    DuplicatePublicCultureError,
    import_public_culture_into_project,
    publish_culture_to_public_library,
)
from config.version import get_version
from config.frontend_urls import build_public_frontend_url


logger = logging.getLogger(__name__)

MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_MEDIA_UPLOAD_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
}


def _invitation_error_response(exc: InvitationFlowError) -> Response:
    """Build a consistent error response for invitation domain errors."""
    status_code = status.HTTP_403_FORBIDDEN if exc.code == 'email_mismatch' else status.HTTP_400_BAD_REQUEST
    return Response({'code': exc.code, 'detail': exc.message}, status=status_code)


def _send_project_invitation_email(*, invitation: ProjectInvitation, project_name: str, invited_by: object) -> tuple[bool, str]:
    """Send invitation email and return delivery result plus diagnostic message."""
    support_mail = settings.SUPPORT_CONTACT_EMAIL
    invite_link = build_public_frontend_url(f'/invite/accept?token={invitation.token}')
    with translation.override('de'):
        subject = _('Einladung zu OpenFarmPlanner: %(project)s') % {'project': project_name}
        body = render_to_string('accounts/emails/project_invitation_email.txt', {
            'project_name': project_name,
            'role': invitation.role,
            'invite_link': invite_link,
            'invited_by': invited_by,
        })

    non_delivery_backends = {
        'django.core.mail.backends.console.EmailBackend',
        'django.core.mail.backends.locmem.EmailBackend',
        'django.core.mail.backends.filebased.EmailBackend',
        'django.core.mail.backends.dummy.EmailBackend',
    }
    backend_is_delivery_capable = settings.EMAIL_BACKEND not in non_delivery_backends

    if not backend_is_delivery_capable:
        logger.info('Project invitation created without outbound email delivery because backend=%s', settings.EMAIL_BACKEND)
        return False, (
            'Die E-Mail konnte nicht gesendet werden. '
            f'Bitte kontaktiere [{support_mail}](mailto:{support_mail}).'
        )

    try:
        sent_count = send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [invitation.email], fail_silently=False)
        if sent_count > 0:
            return True, ''
        logger.error(
            'Project invitation email backend accepted request but returned zero deliveries',
            extra={'project_id': invitation.project_id, 'invitation_id': invitation.id, 'email': invitation.email},
        )
        return False, (
            'Die E-Mail konnte nicht gesendet werden. '
            f'Bitte kontaktiere [{support_mail}](mailto:{support_mail}).'
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            'Project invitation email could not be sent',
            extra={'project_id': invitation.project_id, 'invitation_id': invitation.id, 'email': invitation.email},
        )
        return False, (
            'Die E-Mail konnte nicht gesendet werden. '
            f'Bitte kontaktiere [{support_mail}](mailto:{support_mail}).'
        )


def _coerce_request_string(value, default='') -> str:
    """Coerce request payload values to safe strings."""
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    if isinstance(value, list):
        if not value:
            return default
        first = value[0]
        if isinstance(first, str):
            return first.strip()
        return str(first).strip()
    return default


class VersionView(APIView):
    """Return the current backend/API version."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):  # noqa: ANN001, ARG002
        return Response({'version': get_version()})


def agent_login_consume_view(request, token: str):  # noqa: ANN001
    """Use an agent login token, establish session, and redirect to frontend."""
    if not getattr(settings, 'AGENT_LOGIN_ENABLED', False):
        return HttpResponseForbidden('Agent login is disabled.')

    token_hash = AgentLoginToken.hash_token(token)
    link = AgentLoginToken.objects.select_related('created_by', 'project').filter(token_hash=token_hash).first()
    if link is None:
        return HttpResponseBadRequest('Invalid token.')
    if link.used_at is not None:
        return HttpResponseBadRequest('Token already used.')
    if link.expires_at is not None and timezone.now() >= link.expires_at:
        return HttpResponseBadRequest('Token expired.')
    if not link.created_by.is_active or not link.created_by.is_superuser:
        return HttpResponseForbidden('Token creator is not allowed.')

    login(request, link.created_by)
    link.used_at = timezone.now()
    link.used_by_ip = request.META.get('REMOTE_ADDR')
    link.used_user_agent = (request.META.get('HTTP_USER_AGENT', '') or '')[:512]
    link.save(update_fields=['used_at', 'used_by_ip', 'used_user_agent'])

    request.session['agent_mode'] = True
    request.session['agent_project_id'] = link.project_id
    request.session.modified = True

    return redirect(build_public_frontend_url('/app/cultures'))


def _apply_invitation_project_settings(*, user, project: Project) -> dict[str, int | str]:
    """Persist accepted invitation project as active/default project and return payload."""
    settings_obj, _ = UserProjectSettings.objects.get_or_create(user=user)
    settings_obj.default_project = project
    settings_obj.last_project = project
    settings_obj.save(update_fields=['default_project', 'last_project', 'updated_at'])
    return {
        'id': project.id,
        'name': project.name,
        'slug': project.slug,
    }






def _build_unique_project_slug(name: str) -> str:
    """Generate a unique project slug from a project name."""
    base_slug = slugify(name) or get_random_string(8).lower()
    candidate = base_slug
    suffix = 2
    while Project.objects.filter(slug=candidate).exists():
        candidate = f'{base_slug}-{suffix}'
        suffix += 1
    return candidate

def _week_start_for_iso_year(iso_year: int) -> date:
    """Return Monday of ISO week 1 for an ISO year."""
    return date.fromisocalendar(iso_year, 1, 1)


def _iso_week_key(day: date) -> str:
    """Return ISO week key in the format YYYY-Www using ISO year and week."""
    iso_year, iso_week, _ = day.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


# Entity types that participate in per-entity revision history and whole-project
# point-in-time restore, in FK-dependency order (parents before children).
_RESTORABLE_ENTITY_TYPES: list[tuple[type, str]] = [
    (Location, 'location'),
    (Field, 'field'),
    (Bed, 'bed'),
    (BedLayout, 'bed_layout'),
    (FieldLayout, 'field_layout'),
    (Supplier, 'supplier'),
    (Culture, 'culture'),
    (PlantingPlan, 'planting_plan'),
    (Task, 'task'),
    (NoteAttachment, 'note_attachment'),
]

# Entity types recorded in history but not part of whole-project restore
# (mirrors the entities `_serialize_project_state` used to omit).
_ENTITY_TYPE_LABELS: dict[type, str] = {model: label for model, label in _RESTORABLE_ENTITY_TYPES} | {
    MediaFile: 'media_file',
    SeedPackage: 'seed_package',
    CultureSupplierData: 'culture_supplier_data',
}


def _entity_type_for(instance) -> str:
    return _ENTITY_TYPE_LABELS.get(type(instance), type(instance).__name__.lower())


def _current_actor_label(request) -> str:
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return ''
    display_name = (getattr(user, 'display_name', '') or '').strip()
    if display_name:
        return display_name
    full_name = (user.get_full_name() or '').strip()
    if full_name:
        return full_name
    return user.email or user.username or ''


def _serialize_instance(instance) -> dict[str, Any]:
    """Serialize a single model instance's current DB row to a JSON-safe dict."""
    manager = getattr(type(instance), 'all_objects', None) or type(instance)._base_manager
    row = manager.filter(pk=instance.pk).values().first()
    if row is None:
        # Instance has already been deleted from the DB (hard delete) — fall back
        # to its still-populated in-memory field values.
        row = {field.attname: getattr(instance, field.attname) for field in instance._meta.concrete_fields}
    return json.loads(json.dumps(row, cls=DjangoJSONEncoder))


def _diff_changed_fields(previous: dict[str, Any], current: dict[str, Any]) -> list[str]:
    return [
        key for key, value in current.items()
        if key not in {'created_at', 'updated_at'} and previous.get(key) != value
    ]


def _entity_display_name(instance) -> str:
    if isinstance(instance, Culture):
        return format_culture_display_name(instance.name, instance.variety) or ''
    if isinstance(instance, PlantingPlan):
        culture_label = format_culture_display_name(instance.culture.name, instance.culture.variety) if instance.culture_id else None
        bed_label = instance.bed.name if instance.bed_id else None
        return ' / '.join(part for part in (culture_label, bed_label) if part)
    if isinstance(instance, (CultureSupplierData, SeedPackage)):
        return format_culture_display_name(instance.culture.name, instance.culture.variety) if instance.culture_id else ''
    if isinstance(instance, Task):
        return instance.title or ''
    return getattr(instance, 'name', None) or ''


def record_entity_revision(
    *,
    project: Project,
    entity_type: str,
    object_id: int,
    action: str,
    snapshot: dict[str, Any],
    display_name: str = '',
    changed_fields: list[str] | None = None,
    user_name: str = '',
) -> None:
    EntityRevision.objects.create(
        project=project,
        entity_type=entity_type,
        object_id=object_id,
        action=action,
        display_name=display_name or '',
        snapshot=snapshot,
        changed_fields=changed_fields if changed_fields is not None else ([EntityRevision.ACTION_CREATED] if action == EntityRevision.ACTION_CREATED else []),
        user_name=user_name or '',
    )


_ENTITY_HISTORY_IGNORED_FIELDS = {
    'id',
    'created_at',
    'updated_at',
    'deleted_at',
    'project_id',
    'created_by_id',
    'updated_by_id',
    'name_normalized',
    'variety_normalized',
}


def _build_entity_revision_changes(
    snapshot: dict[str, Any],
    previous_snapshot: dict[str, Any] | None,
    changed_fields: list[str] | None,
) -> list[dict[str, Any]]:
    """Build displayable field changes from entity revision snapshots."""
    if not isinstance(snapshot, dict):
        return []

    if not isinstance(changed_fields, list):
        changed_fields = []

    changes: list[dict[str, Any]] = []
    for field in changed_fields:
        if field in _ENTITY_HISTORY_IGNORED_FIELDS:
            continue
        if field == EntityRevision.ACTION_CREATED:
            changes.append({
                'field': field,
                'old_value': None,
                'new_value': True,
            })
            continue
        if field not in snapshot:
            continue

        old_value = previous_snapshot.get(field) if isinstance(previous_snapshot, dict) else None
        changes.append({
            'field': field,
            'old_value': old_value,
            'new_value': snapshot.get(field),
        })

    return changes


def _entity_states_at(project: Project, entity_type: str, target_time) -> dict[int, dict[str, Any] | None]:
    """Return {object_id: snapshot} for every object with a revision at/before
    target_time; a value of None marks an object that was deleted by then."""
    revisions = (
        EntityRevision.objects
        .filter(project=project, entity_type=entity_type, created_at__lte=target_time)
        .order_by('object_id', '-created_at')
    )
    states: dict[int, dict[str, Any] | None] = {}
    for revision in revisions:
        if revision.object_id in states:
            continue
        states[revision.object_id] = None if revision.action == EntityRevision.ACTION_DELETED else revision.snapshot
    return states


def _restore_project_state_at(project: Project, target_time) -> None:
    """Reconstruct every restorable entity type to its state at target_time."""
    with transaction.atomic():
        for model, _entity_type in reversed(_RESTORABLE_ENTITY_TYPES):
            manager = getattr(model, 'all_objects', None) or model._base_manager
            manager.filter(project=project).delete()

        for model, entity_type in _RESTORABLE_ENTITY_TYPES:
            allowed_fields = {field.attname for field in model._meta.concrete_fields}
            states = _entity_states_at(project, entity_type, target_time)
            rows = []
            for snapshot in states.values():
                if snapshot is None:
                    continue
                # Old snapshots may carry fields since renamed/removed from the model
                # (schema changes don't rewrite historical JSON) — drop anything the
                # current model no longer has instead of crashing on an unknown kwarg.
                row_data = {key: value for key, value in snapshot.items() if key in allowed_fields}
                row_data['project_id'] = project.id
                rows.append(model(**row_data))
            if rows:
                model.objects.bulk_create(rows)



class BedLayoutByLocationView(APIView):
    """GET/PUT bed and field layout entries for a given location."""

    def get(self, request, location_id: int):
        active_project = get_active_project_or_400(request)
        location = get_object_or_404(Location, pk=location_id, project=active_project)
        bed_layouts = BedLayout.objects.filter(location=location).select_related('bed__field')
        field_layouts = FieldLayout.objects.filter(location=location).select_related('field')
        return Response(
            {
                'bed_layouts': BedLayoutSerializer(bed_layouts, many=True).data,
                'field_layouts': FieldLayoutSerializer(field_layouts, many=True).data,
            }
        )

    def put(self, request, location_id: int):
        active_project = get_active_project_or_400(request)
        location = get_object_or_404(Location, pk=location_id, project=active_project)
        bed_payload = request.data.get('bed_layouts')
        field_payload = request.data.get('field_layouts')

        # Backward compatibility with Phase-1 payload format.
        if bed_payload is None and field_payload is None:
            bed_payload = request.data.get('layouts', request.data)
            field_payload = []

        if not isinstance(bed_payload, list) or not isinstance(field_payload, list):
            return Response(
                {'detail': 'Expected lists under "bed_layouts" and "field_layouts".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bed_ids = [item.get('bed') for item in bed_payload if isinstance(item, dict) and item.get('bed') is not None]
        beds = {bed.id: bed for bed in Bed.objects.select_related('field__location').filter(id__in=bed_ids)}

        field_ids = [item.get('field') for item in field_payload if isinstance(item, dict) and item.get('field') is not None]
        fields = {field.id: field for field in Field.objects.select_related('location').filter(id__in=field_ids)}

        saved_bed_layouts: list[BedLayout] = []
        saved_field_layouts: list[FieldLayout] = []

        with transaction.atomic():
            for item in bed_payload:
                if not isinstance(item, dict):
                    return Response({'detail': 'Each bed layout entry must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

                bed_id = item.get('bed')
                bed = beds.get(bed_id)
                if bed is None:
                    return Response({'detail': f'Bed {bed_id} does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
                if bed.field.location_id != location.id:
                    return Response({'detail': f'Bed {bed_id} does not belong to location {location.id}.'}, status=status.HTTP_400_BAD_REQUEST)

                layout, _ = BedLayout.objects.update_or_create(
                    bed=bed,
                    defaults={
                        'location': location,
                        'project': location.project,
                        'x': float(item.get('x', 0.0)),
                        'y': float(item.get('y', 0.0)),
                        'scale': item.get('scale'),
                        'version': int(item.get('version', 1)),
                    },
                )
                saved_bed_layouts.append(layout)

            for item in field_payload:
                if not isinstance(item, dict):
                    return Response({'detail': 'Each field layout entry must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

                field_id = item.get('field')
                field = fields.get(field_id)
                if field is None:
                    return Response({'detail': f'Field {field_id} does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
                if field.location_id != location.id:
                    return Response({'detail': f'Field {field_id} does not belong to location {location.id}.'}, status=status.HTTP_400_BAD_REQUEST)

                layout, _ = FieldLayout.objects.update_or_create(
                    field=field,
                    defaults={
                        'location': location,
                        'project': location.project,
                        'x': float(item.get('x', 0.0)),
                        'y': float(item.get('y', 0.0)),
                        'scale': item.get('scale'),
                        'version': int(item.get('version', 1)),
                    },
                )
                saved_field_layouts.append(layout)

        return Response(
            {
                'bed_layouts': BedLayoutSerializer(saved_bed_layouts, many=True).data,
                'field_layouts': FieldLayoutSerializer(saved_field_layouts, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class YieldCalendarListView(generics.GenericAPIView):
    """Return expected yield distribution aggregated by ISO week and culture."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        year_param = request.query_params.get('year')
        try:
            iso_year = int(year_param) if year_param else date.today().year
        except ValueError:
            return Response({'detail': 'Invalid year parameter.'}, status=status.HTTP_400_BAD_REQUEST)

        if iso_year < 1 or iso_year > 9999:
            return Response({'detail': 'Year out of supported range.'}, status=status.HTTP_400_BAD_REQUEST)

        year_start = _week_start_for_iso_year(iso_year)
        year_end = _week_start_for_iso_year(iso_year + 1) if iso_year < 9999 else date.max

        plans = (
            PlantingPlan.objects
            .select_related('culture')
            .filter(
                project=active_project,
                harvest_date__isnull=False,
                harvest_end_date__isnull=False,
                culture__expected_yield__gt=0,
                harvest_date__lt=year_end,
                harvest_end_date__gt=year_start,
            )
        )

        weekly_data: dict[str, dict[str, object]] = {}

        for plan in plans:
            harvest_start = plan.harvest_date
            harvest_end = plan.harvest_end_date
            if harvest_end <= harvest_start:
                continue

            total_days = (harvest_end - harvest_start).days
            if total_days <= 0:
                continue

            expected_yield = Decimal(plan.culture.expected_yield)
            first_week_start = harvest_start - timedelta(days=harvest_start.weekday())
            week_start = first_week_start

            while week_start < harvest_end:
                week_end = week_start + timedelta(days=7)
                overlap_start = max(harvest_start, week_start)
                overlap_end = min(harvest_end, week_end)
                overlap_days = (overlap_end - overlap_start).days

                if overlap_days > 0:
                    iso_year_of_week, _, _ = week_start.isocalendar()
                    if iso_year_of_week == iso_year:
                        iso_week = _iso_week_key(week_start)
                        week_entry = weekly_data.setdefault(
                            iso_week,
                            {
                                'iso_week': iso_week,
                                'week_start': week_start,
                                'week_end': week_end,
                                'cultures': defaultdict(Decimal),
                            },
                        )
                        culture_key = (
                            plan.culture_id,
                            plan.culture.name,
                            plan.culture.display_color or '#3b82f6',
                        )
                        contribution = expected_yield * Decimal(overlap_days) / Decimal(total_days)
                        week_entry['cultures'][culture_key] += contribution

                week_start += timedelta(days=7)

        response_data = []
        for iso_week in sorted(weekly_data.keys()):
            week_entry = weekly_data[iso_week]
            cultures_payload = []
            for (culture_id, culture_name, color), value in sorted(week_entry['cultures'].items(), key=lambda c: c[0][1]):
                rounded_yield = value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                if rounded_yield <= 0:
                    continue
                cultures_payload.append(
                    {
                        'culture_id': culture_id,
                        'culture_name': culture_name,
                        'color': color,
                        'yield': float(rounded_yield),
                    }
                )

            if not cultures_payload:
                continue

            response_data.append(
                {
                    'iso_week': week_entry['iso_week'],
                    'week_start': week_entry['week_start'].isoformat(),
                    'week_end': week_entry['week_end'].isoformat(),
                    'cultures': cultures_payload,
                }
            )

        return Response(response_data)


class ProjectRevisionMixin:
    """Record an EntityRevision for the active project after a mutation."""

    def record_revision(
        self,
        instance,
        action: str,
        *,
        previous_snapshot: dict[str, Any] | None = None,
        object_id: int | None = None,
        snapshot: dict[str, Any] | None = None,
        display_name: str | None = None,
        changed_fields: list[str] | None = None,
    ) -> None:
        resolved_snapshot = snapshot if snapshot is not None else _serialize_instance(instance)
        resolved_changed_fields = changed_fields
        if resolved_changed_fields is None:
            if action == EntityRevision.ACTION_CREATED:
                resolved_changed_fields = [EntityRevision.ACTION_CREATED]
            elif previous_snapshot is not None:
                resolved_changed_fields = _diff_changed_fields(previous_snapshot, resolved_snapshot)
            else:
                resolved_changed_fields = []
        record_entity_revision(
            project=getattr(self.request, 'active_project', None),
            entity_type=_entity_type_for(instance),
            object_id=object_id if object_id is not None else instance.pk,
            action=action,
            snapshot=resolved_snapshot,
            display_name=display_name if display_name is not None else _entity_display_name(instance),
            changed_fields=resolved_changed_fields,
            user_name=_current_actor_label(self.request),
        )





class ProjectScopedMixin:
    """Resolve active project from request and hard-scope querysets."""

    ensure_default_location = False

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        request.active_project = get_active_project_or_400(request)
        if self.ensure_default_location:
            self.ensure_active_project_location()

    def ensure_active_project_location(self) -> None:
        """Create the default location for legacy projects that do not have one.

        Called from `initial()` on every request of viewsets that opt in via
        `ensure_default_location`, so a page firing several such requests at
        once (e.g. locations/fields/beds all loading together for a brand-new
        project) can have multiple of them race here concurrently. Under
        SQLite this read-then-write is prone to "database is locked": if
        another connection commits a write between our `exists()` read and
        the `create()`, the write can fail immediately rather than merely
        wait for a lock, regardless of the busy timeout. Each attempt runs in
        its own savepoint so a failed attempt only rolls back that savepoint
        (not the whole request), and a short retry gives the other request's
        transaction time to land — after which our `exists()` check sees its
        location and we return without creating a duplicate.
        """
        project = self.request.active_project
        attempts = 3
        for attempt in range(attempts):
            try:
                with transaction.atomic():
                    if Location.objects.filter(project=project).exists():
                        return
                    Location.objects.create(project=project, name='Hauptstandort')
                return
            except OperationalError as exc:
                if attempt == attempts - 1 or 'locked' not in str(exc).lower():
                    raise
                time.sleep(0.05 * (attempt + 1))

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(queryset.model, 'project'):
            return queryset.filter(project=self.request.active_project)
        return queryset

    def perform_create(self, serializer):
        if 'project' in serializer.fields:
            serializer.save(project=self.request.active_project)
            return
        serializer.save()

class LocationViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Location model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for farm locations. All locations are returned without filtering.
    
    Attributes:
        queryset: All Location objects ordered by name
        serializer_class: LocationSerializer for serialization
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    ensure_default_location = True

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        instance = serializer.save()
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def perform_destroy(self, instance):
        instance_id = instance.pk
        snapshot = _serialize_instance(instance)
        display_name = _entity_display_name(instance)
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=instance_id, snapshot=snapshot, display_name=display_name, changed_fields=[],
        )



class SupplierViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Supplier model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for seed suppliers. Supports filtering by name via query parameter.
    POST endpoint rejects duplicate names within the active project.
    
    Attributes:
        queryset: All Supplier objects ordered by name
        serializer_class: SupplierSerializer for serialization
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    def _build_delete_usage(self, supplier: Supplier) -> dict[str, int | bool | list[int]]:
        supplier_culture_ids = set(
            Culture.objects.filter(
                project=supplier.project,
                deleted_at__isnull=True,
                supplier=supplier,
            ).values_list('id', flat=True)
        )
        seed_demand_culture_ids = set(
            Culture.objects.filter(
                project=supplier.project,
                deleted_at__isnull=True,
                selected_seed_demand_supplier=supplier,
            ).values_list('id', flat=True)
        )
        supplier_data_culture_ids = set(
            CultureSupplierData.objects.filter(
                project=supplier.project,
                supplier=supplier,
                culture__deleted_at__isnull=True,
            ).values_list('culture_id', flat=True)
        )
        supplier_data_rows = CultureSupplierData.objects.filter(
            project=supplier.project,
            supplier=supplier,
            culture__deleted_at__isnull=True,
        ).count()
        total_culture_ids = supplier_culture_ids | seed_demand_culture_ids | supplier_data_culture_ids

        return {
            'can_delete': len(total_culture_ids) == 0 and supplier_data_rows == 0,
            'culture_count': len(supplier_culture_ids),
            'seed_demand_culture_count': len(seed_demand_culture_ids),
            'supplier_data_culture_count': len(supplier_data_culture_ids),
            'supplier_data_count': supplier_data_rows,
            'total_culture_count': len(total_culture_ids),
            'culture_ids': sorted(total_culture_ids),
        }

    def _build_supplier_delete_undo_payload(self, supplier: Supplier) -> dict[str, object]:
        supplier_cultures = list(
            Culture.all_objects.filter(project=supplier.project, supplier=supplier).values_list('id', flat=True)
        )
        seed_demand_cultures = list(
            Culture.all_objects.filter(
                project=supplier.project,
                selected_seed_demand_supplier=supplier,
            ).values_list('id', flat=True)
        )
        supplier_data_rows = []
        for row in CultureSupplierData.objects.filter(project=supplier.project, supplier=supplier):
            supplier_data_rows.append({
                'id': row.id,
                'culture_id': row.culture_id,
                'supplier_name': row.supplier_name,
                'supplier_url': row.supplier_url,
                'supplier_product_name': row.supplier_product_name,
                'supplier_product_url': row.supplier_product_url,
                'packaging_sizes': row.packaging_sizes,
                'thousand_kernel_weight_g': (
                    str(row.thousand_kernel_weight_g)
                    if row.thousand_kernel_weight_g is not None
                    else None
                ),
                'germination_rate': row.germination_rate,
                'price': str(row.price) if row.price is not None else None,
                'notes': row.notes,
                'source_url': row.source_url,
            })

        return {
            'supplier': {
                'id': supplier.id,
                'name': supplier.name,
                'homepage_url': supplier.homepage_url,
                'slug': supplier.slug,
                'allowed_domains': supplier.allowed_domains,
            },
            'culture_ids': supplier_cultures,
            'seed_demand_culture_ids': seed_demand_cultures,
            'supplier_data': supplier_data_rows,
        }

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        try:
            instance = serializer.save()
        except IntegrityError as exc:
            raise DRFValidationError({'name': ['Ein Lieferant mit diesem Namen existiert bereits.']}) from exc
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    @action(detail=True, methods=['get'], url_path='delete-usage')
    def delete_usage(self, request: Request, pk: int | None = None) -> Response:
        supplier = self.get_object()
        return Response(self._build_delete_usage(supplier))

    def destroy(self, request: Request, *args: object, **kwargs: object) -> Response:
        instance = self.get_object()
        usage = self._build_delete_usage(instance)
        if not usage['can_delete']:
            return Response(
                {
                    'detail': 'Supplier is still used and cannot be deleted.',
                    'usage': usage,
                },
                status=status.HTTP_409_CONFLICT,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='unlink-and-delete')
    def unlink_and_delete(self, request: Request, pk: int | None = None) -> Response:
        supplier = self.get_object()
        usage = self._build_delete_usage(supplier)
        undo_payload = self._build_supplier_delete_undo_payload(supplier)

        with transaction.atomic():
            Culture.all_objects.filter(project=supplier.project, supplier=supplier).update(supplier=None)
            Culture.all_objects.filter(
                project=supplier.project,
                selected_seed_demand_supplier=supplier,
            ).update(selected_seed_demand_supplier=None)
            CultureSupplierData.objects.filter(project=supplier.project, supplier=supplier).delete()
            supplier_id = supplier.pk
            supplier_snapshot = _serialize_instance(supplier)
            supplier_name = supplier.name
            supplier.delete()
            self.record_revision(
                supplier, EntityRevision.ACTION_DELETED,
                object_id=supplier_id, snapshot=supplier_snapshot, display_name=supplier_name, changed_fields=[],
            )

        return Response({
            'affected_culture_count': usage['total_culture_count'],
            'undo_payload': undo_payload,
        })

    @action(detail=False, methods=['post'], url_path='restore-unlinked-delete')
    def restore_unlinked_delete(self, request: Request) -> Response:
        active_project = request.active_project
        payload = request.data if isinstance(request.data, dict) else {}
        supplier_payload = payload.get('supplier')
        if not isinstance(supplier_payload, dict):
            raise DRFValidationError({'supplier': ['Supplier restore data is required.']})

        supplier_id = supplier_payload.get('id')
        if not isinstance(supplier_id, int):
            raise DRFValidationError({'supplier': ['Supplier id is required.']})
        if Supplier.objects.filter(project=active_project, pk=supplier_id).exists():
            return Response(
                {'detail': 'Supplier cannot be restored because the id is already in use.'},
                status=status.HTTP_409_CONFLICT,
            )

        culture_ids = [item for item in payload.get('culture_ids', []) if isinstance(item, int)]
        seed_demand_culture_ids = [
            item for item in payload.get('seed_demand_culture_ids', []) if isinstance(item, int)
        ]
        supplier_data_rows = payload.get('supplier_data', [])
        if not isinstance(supplier_data_rows, list):
            supplier_data_rows = []

        try:
            with transaction.atomic():
                supplier = Supplier.objects.create(
                    id=supplier_id,
                    project=active_project,
                    name=str(supplier_payload.get('name') or ''),
                    homepage_url=str(supplier_payload.get('homepage_url') or ''),
                    slug=str(supplier_payload.get('slug') or ''),
                    allowed_domains=supplier_payload.get('allowed_domains') or [],
                )
                Culture.all_objects.filter(project=active_project, id__in=culture_ids).update(supplier=supplier)
                Culture.all_objects.filter(
                    project=active_project,
                    id__in=seed_demand_culture_ids,
                ).update(selected_seed_demand_supplier=supplier)

                restored_supplier_data_count = 0
                for row_payload in supplier_data_rows:
                    if not isinstance(row_payload, dict):
                        continue
                    culture_id = row_payload.get('culture_id')
                    if not isinstance(culture_id, int):
                        continue
                    if not Culture.all_objects.filter(project=active_project, pk=culture_id).exists():
                        continue
                    CultureSupplierData.objects.create(
                        id=row_payload.get('id') if isinstance(row_payload.get('id'), int) else None,
                        culture_id=culture_id,
                        supplier=supplier,
                        project=active_project,
                        supplier_name=str(row_payload.get('supplier_name') or ''),
                        supplier_url=str(row_payload.get('supplier_url') or ''),
                        supplier_product_name=str(row_payload.get('supplier_product_name') or ''),
                        supplier_product_url=str(row_payload.get('supplier_product_url') or ''),
                        packaging_sizes=row_payload.get('packaging_sizes') or [],
                        thousand_kernel_weight_g=(
                            Decimal(str(row_payload['thousand_kernel_weight_g']))
                            if row_payload.get('thousand_kernel_weight_g') is not None
                            else None
                        ),
                        germination_rate=row_payload.get('germination_rate'),
                        price=(
                            Decimal(str(row_payload['price']))
                            if row_payload.get('price') is not None
                            else None
                        ),
                        notes=str(row_payload.get('notes') or ''),
                        source_url=str(row_payload.get('source_url') or ''),
                    )
                    restored_supplier_data_count += 1

                self.record_revision(supplier, EntityRevision.ACTION_RESTORED)
        except (IntegrityError, ValueError) as exc:
            raise DRFValidationError({'detail': ['Supplier could not be restored.']}) from exc

        serializer = self.get_serializer(supplier)
        return Response({
            'supplier': serializer.data,
            'restored_culture_count': len(set(culture_ids) | set(seed_demand_culture_ids)),
            'restored_supplier_data_count': restored_supplier_data_count,
        })

    def perform_destroy(self, instance: Supplier) -> None:
        instance_id = instance.pk
        snapshot = _serialize_instance(instance)
        name = instance.name
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=instance_id, snapshot=snapshot, display_name=name, changed_fields=[],
        )

    
    def get_queryset(self):
        """Filter suppliers by name if query parameter is provided.
        
        :return: Filtered queryset based on query parameters
        """
        queryset = super().get_queryset()
        query = self.request.query_params.get('q', None)

        if query:
            # Case-insensitive search in name
            queryset = queryset.filter(name__icontains=query)

        queryset = queryset.order_by('name')

        # Limit only list responses for autocomplete-like usage.
        # Detail/update/delete must be able to resolve any existing supplier by PK.
        if getattr(self, 'action', None) == 'list':
            return queryset[:20]

        return queryset
    
    def create(self, request, *args, **kwargs):
        """Create a supplier with project-scoped duplicate-name validation.
        
        :param request: HTTP request containing supplier data
        :return: Response with supplier data and created flag
        """
        name = (request.data.get('name') or '').strip()
        homepage_url = (request.data.get('homepage_url') or '').strip()
        allowed_domains = request.data.get('allowed_domains', [])

        if not name:
            return Response(
                {'name': ['Dieses Feld ist erforderlich.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Normalize homepage_url (prepend https:// if no protocol)
        if homepage_url and not homepage_url.startswith(('http://', 'https://')):
            homepage_url = f'https://{homepage_url}'
        
        # Validate homepage_url format
        from django.core.validators import URLValidator
        from django.core.exceptions import ValidationError as DjangoValidationError
        url_validator = URLValidator()
        try:
            if homepage_url:
                url_validator(homepage_url)
        except DjangoValidationError:
            return Response(
                {'homepage_url': ['Bitte geben Sie eine gültige URL ein.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate allowed_domains
        if allowed_domains and not isinstance(allowed_domains, list):
            return Response(
                {'allowed_domains': ['Bitte geben Sie eine Liste von Domains an.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        if allowed_domains:
            normalized_domains = Supplier.normalize_allowed_domains(allowed_domains)
            invalid = [domain for domain in normalized_domains if not Supplier._is_valid_domain(Supplier._normalize_domain(domain))]
            if invalid:
                return Response(
                    {'allowed_domains': [f'Ungültige Domain(s): {", ".join(invalid)}. Domains müssen gültige Hostnamen ohne Schema oder Pfad sein.']},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Check normalized duplicates before relying on the database constraint.
        from .utils import normalize_supplier_name
        normalized = normalize_supplier_name(name) or ''

        duplicate_error = {'name': ['Ein Lieferant mit diesem Namen existiert bereits.']}
        if Supplier.objects.filter(project=request.active_project, name_normalized=normalized).exists():
            raise DRFValidationError(duplicate_error)

        supplier_defaults = {
            'name': name,
            'homepage_url': homepage_url,
            'allowed_domains': Supplier.normalize_allowed_domains(allowed_domains) if isinstance(allowed_domains, list) else [],
            'project': request.active_project,
        }
        try:
            with transaction.atomic():
                supplier = Supplier.objects.create(**supplier_defaults)
        except IntegrityError as exc:
            if Supplier.objects.filter(project=request.active_project, name_normalized=normalized).exists():
                raise DRFValidationError(duplicate_error) from exc
            raise
        
        serializer = self.get_serializer(supplier)
        data = serializer.data
        data['created'] = True
        
        self.record_revision(supplier, EntityRevision.ACTION_CREATED)
        return Response(
            data,
            status=status.HTTP_201_CREATED
        )


class FieldViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Field model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for fields within locations.
    
    Attributes:
        queryset: All Field objects ordered by location and name
        serializer_class: FieldSerializer for serialization
    """
    queryset = Field.objects.select_related('location').all()
    serializer_class = FieldSerializer

    def perform_create(self, serializer):
        try:
            instance = serializer.save(project=self.request.active_project)
        except IntegrityError as exc:
            raise DRFValidationError({'name': [FIELD_NAME_DUPLICATE_MESSAGE]}) from exc
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        try:
            instance = serializer.save()
        except IntegrityError as exc:
            raise DRFValidationError({'name': [FIELD_NAME_DUPLICATE_MESSAGE]}) from exc
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def perform_destroy(self, instance):
        instance_id = instance.pk
        snapshot = _serialize_instance(instance)
        name = instance.name
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=instance_id, snapshot=snapshot, display_name=name, changed_fields=[],
        )



class BedViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Bed model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for beds within fields.
    
    Attributes:
        queryset: All Bed objects ordered by field and name
        serializer_class: BedSerializer for serialization
    """
    queryset = Bed.objects.select_related('field', 'field__location').all()
    serializer_class = BedSerializer

    def perform_create(self, serializer):
        try:
            instance = serializer.save(project=self.request.active_project)
        except IntegrityError as exc:
            raise DRFValidationError({'name': [BED_NAME_DUPLICATE_MESSAGE]}) from exc
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        try:
            instance = serializer.save()
        except IntegrityError as exc:
            raise DRFValidationError({'name': [BED_NAME_DUPLICATE_MESSAGE]}) from exc
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def perform_destroy(self, instance):
        instance_id = instance.pk
        snapshot = _serialize_instance(instance)
        name = instance.name
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=instance_id, snapshot=snapshot, display_name=name, changed_fields=[],
        )



class CultureViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    """ViewSet for Culture model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for crop cultures and varieties.
    
    Attributes:
        queryset: All Culture objects ordered by name and variety
        serializer_class: CultureSerializer for serialization
    """
    queryset = Culture.objects.select_related('supplier', 'image_file', 'source_public_culture')
    serializer_class = CultureSerializer

    def _set_latest_revision_actor(self, culture: Culture) -> None:
        actor_label = _current_actor_label(self.request)
        if not actor_label:
            return
        latest_revision = (
            EntityRevision.objects
            .filter(project_id=culture.project_id, entity_type='culture', object_id=culture.pk)
            .order_by('-id')
            .first()
        )
        if latest_revision and not latest_revision.user_name:
            latest_revision.user_name = actor_label[:150]
            latest_revision.save(update_fields=['user_name'])

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self._set_latest_revision_actor(instance)

    def get_queryset(self):
        include_deleted = self.request.query_params.get('include_deleted') in {'1', 'true', 'True'}
        manager = Culture.all_objects if include_deleted else Culture.objects
        owned_public_cultures_prefetch = Prefetch(
            'published_public_cultures',
            queryset=PublicCulture.objects.filter(
                created_by=self.request.user,
                status=PublicCulture.STATUS_PUBLISHED,
            ).order_by('-updated_at', '-id'),
            to_attr='_prefetched_owned_public_cultures',
        )
        return (
            manager
            .filter(project=self.request.active_project)
            .select_related('supplier', 'image_file', 'source_public_culture')
            .prefetch_related('supplier_data__supplier', 'seed_packages', owned_public_cultures_prefetch)
        )

    @action(detail=False, methods=['get'], url_path='duplicate-check')
    def duplicate_check(self, request):
        """Check whether a culture identity already exists in the active project."""
        from .utils import normalize_text

        normalized_name = normalize_text(request.query_params.get('name'))
        normalized_variety = normalize_text(request.query_params.get('variety'))
        if not normalized_name or not normalized_variety:
            return Response({'exists': False})

        queryset = self.get_queryset().filter(
            name_normalized=normalized_name,
            variety_normalized=normalized_variety,
        )
        exclude_id = request.query_params.get('exclude_id')
        if exclude_id:
            try:
                queryset = queryset.exclude(pk=int(exclude_id))
            except (TypeError, ValueError):
                pass

        return Response({'exists': queryset.exists()})

    def _resolve_supplier(self, culture_data: dict) -> Supplier | None:
        """Resolve supplier from culture data using supplier_id or supplier_name.
        
        :param culture_data: Dictionary containing culture data
        :return: Supplier instance or None
        """
        from .utils import normalize_supplier_name
        
        supplier_id = culture_data.get('supplier_id')
        supplier_name = culture_data.get('supplier_name')
        
        if supplier_id:
            try:
                return Supplier.objects.get(id=supplier_id)
            except Supplier.DoesNotExist:
                return None
        elif supplier_name:
            normalized = normalize_supplier_name(supplier_name)
            if normalized:
                supplier, _ = Supplier.objects.get_or_create(
                    name_normalized=normalized,
                    project=self.request.active_project,
                    defaults={
                        'name': supplier_name,
                        'homepage_url': 'https://example.invalid',
                        'project': self.request.active_project,
                    },
                )
                return supplier
        
        return None
    
    def _find_matching_culture(
        self,
        name: str,
        variety: str | None,
        supplier: Supplier | None,
        supplier_name: str | None = None,
    ) -> Culture | None:
        """Find existing culture by normalized fields.
        
        :param name: Culture name
        :param variety: Culture variety (optional)
        :param supplier: Supplier instance (optional)
        :param supplier_name: Supplier name from import data for legacy matching
        :return: Matching Culture instance or None
        """
        from .utils import normalize_text, normalize_supplier_name
        
        name_norm = normalize_text(name) or ''
        variety_norm = normalize_text(variety)
        
        base_queryset = Culture.objects.filter(
            name_normalized=name_norm,
            variety_normalized=variety_norm,
        )

        # Prefer exact FK match when supplier could be resolved.
        if supplier:
            direct_match = base_queryset.filter(supplier=supplier).first()
            if direct_match:
                return direct_match

        # Fallback for legacy/partial imports: match supplier names case-insensitively,
        # whether supplier is stored as FK supplier or legacy seed_supplier text.
        supplier_name_normalized = normalize_supplier_name(supplier_name)
        if not supplier_name_normalized and supplier:
            supplier_name_normalized = supplier.name_normalized

        if supplier_name_normalized:
            for candidate in base_queryset.select_related('supplier'):
                candidate_supplier_normalized = normalize_supplier_name(
                    candidate.supplier.name if candidate.supplier else candidate.seed_supplier
                )
                if candidate_supplier_normalized == supplier_name_normalized:
                    return candidate

        # Final fallback: legacy behavior when no supplier information is available.
        return base_queryset.filter(supplier__isnull=True).first()
    
    def _compute_diff(self, existing_culture: Culture, import_data: dict) -> list[dict]:
        """Compute field differences between existing culture and import data.
        
        :param existing_culture: Existing Culture instance
        :param import_data: Dictionary of import data
        :return: List of field differences
        """
        diff = []
        serializer = CultureSerializer(existing_culture)
        existing_data = serializer.data
        
        # Fields to compare (excluding read-only and auto-generated fields)
        comparable_fields = [
            'name', 'variety', 'notes', 'seed_supplier',
            'crop_family', 'nutrient_demand', 'cultivation_type',
            'growth_duration_days', 'harvest_duration_days', 'propagation_duration_days',
            'harvest_method', 'expected_yield', 'allow_deviation_delivery_weeks',
            'distance_within_row_cm', 'row_spacing_cm', 'sowing_depth_cm',
            'seed_rate_value', 'seed_rate_unit', 'sowing_calculation_safety_percent',
            'seed_rate_direct_value', 'seed_rate_direct_unit', 'sowing_calculation_safety_percent_direct',
            'seed_rate_pre_cultivation_value', 'seed_rate_pre_cultivation_unit', 'sowing_calculation_safety_percent_pre_cultivation',
            'thousand_kernel_weight_g',
            'seeding_requirement', 'seeding_requirement_type', 'display_color'
        ]
        
        for field in comparable_fields:
            if field in import_data:
                import_value = import_data[field]
                existing_value = existing_data.get(field)
                
                # Normalize for comparison
                if import_value != existing_value:
                    # Special handling for None vs empty string
                    if (import_value == '' and existing_value is None) or \
                       (import_value is None and existing_value == ''):
                        continue
                    
                    diff.append({
                        'field': field,
                        'current': existing_value,
                        'new': import_value
                    })
        
        return diff
    
    @action(detail=False, methods=['post'], url_path='import/preview')
    def import_preview(self, request):
        """Preview culture import without writing to database.
        
        Analyzes import data and returns status for each item:
        - 'create': New culture
        - 'update_candidate': Matches existing culture
        
        :param request: HTTP request containing array of culture objects
        :return: Response with preview results for each item
        """
        if not isinstance(request.data, list):
            return Response(
                {'message': 'Request body must be an array of culture objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        
        for idx, culture_data in enumerate(request.data):
            if not isinstance(culture_data, dict) or not culture_data.get('name'):
                results.append({
                    'index': idx,
                    'error': 'Entry must be an object with at least a "name" field.',
                    'import_data': culture_data
                })
                continue
            
            try:
                # Resolve supplier
                supplier = self._resolve_supplier(culture_data)
                
                # Find matching culture
                name = culture_data['name']
                variety = culture_data.get('variety', '')
                matching_culture = self._find_matching_culture(
                    name,
                    variety,
                    supplier,
                    culture_data.get('supplier_name') or culture_data.get('seed_supplier')
                )
                
                if matching_culture:
                    # Compute diff
                    diff = self._compute_diff(matching_culture, culture_data)
                    
                    results.append({
                        'index': idx,
                        'status': 'update_candidate',
                        'matched_culture_id': matching_culture.id,
                        'diff': diff,
                        'import_data': culture_data
                    })
                else:
                    results.append({
                        'index': idx,
                        'status': 'create',
                        'import_data': culture_data
                    })
            except Exception as e:
                results.append({
                    'index': idx,
                    'error': str(e),
                    'import_data': culture_data
                })
        
        return Response({'results': results}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='import/apply')
    def import_apply(self, request):
        """Apply culture import with optional update confirmation.
        
        Creates new cultures and optionally updates existing ones.
        
        :param request: HTTP request with items array and confirm_updates flag
        :return: Response with import summary
        """
        items = request.data.get('items', [])
        confirm_updates = request.data.get('confirm_updates', False)
        
        if not isinstance(items, list):
            return Response(
                {'message': 'Items must be an array of culture objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        for idx, culture_data in enumerate(items):
            if not isinstance(culture_data, dict) or not culture_data.get('name'):
                errors.append({
                    'index': idx,
                    'error': 'Entry must be an object with at least a "name" field.'
                })
                continue
            
            try:
                # Resolve supplier
                supplier = self._resolve_supplier(culture_data)
                if supplier:
                    culture_data['supplier'] = supplier.id
                
                # Find matching culture
                name = culture_data['name']
                variety = culture_data.get('variety', '')
                matching_culture = self._find_matching_culture(
                    name,
                    variety,
                    supplier,
                    culture_data.get('supplier_name') or culture_data.get('seed_supplier')
                )
                
                if matching_culture:
                    if confirm_updates:
                        # Update existing culture
                        serializer = CultureSerializer(
                            matching_culture,
                            data=culture_data,
                            partial=True
                        )
                        if serializer.is_valid():
                            serializer.save()
                            updated_count += 1
                        else:
                            errors.append({
                                'index': idx,
                                'error': serializer.errors
                            })
                    else:
                        # Skip update without confirmation
                        skipped_count += 1
                else:
                    # Create new culture
                    serializer = CultureSerializer(data=culture_data)
                    if serializer.is_valid():
                        serializer.save()
                        created_count += 1
                    else:
                        errors.append({
                            'index': idx,
                            'error': serializer.errors
                        })
            except Exception as e:
                errors.append({
                    'index': idx,
                    'error': str(e)
                })
        
        return Response({
            'created_count': created_count,
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'errors': errors
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        culture = self.get_object()
        if culture.deleted_at is not None:
            return Response(status=status.HTTP_204_NO_CONTENT)

        culture.deleted_at = timezone.now()
        culture._history_action = EntityRevision.ACTION_DELETED
        culture.save()
        self._set_latest_revision_actor(culture)

        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id, orphaned_at__isnull=True).update(orphaned_at=timezone.now())

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='undelete')
    def undelete(self, request, pk=None):
        culture = self.get_object()
        culture.deleted_at = None
        culture._history_action = EntityRevision.ACTION_RESTORED
        culture.save()
        self._set_latest_revision_actor(culture)
        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id).update(orphaned_at=None)
        return Response(self.get_serializer(culture).data, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        instance = self.get_object()
        previous_media_id = instance.image_file_id
        updated = serializer.save()
        self._set_latest_revision_actor(updated)
        if previous_media_id and previous_media_id != updated.image_file_id:
            MediaFile.objects.filter(id=previous_media_id, orphaned_at__isnull=True).update(orphaned_at=timezone.now())
        if updated.image_file_id:
            MediaFile.objects.filter(id=updated.image_file_id).update(orphaned_at=None)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        culture = self.get_object()
        since = timezone.now() - timedelta(days=30)
        rows = list(
            EntityRevision.objects
            .filter(project_id=culture.project_id, entity_type='culture', object_id=culture.pk, created_at__gte=since)
            .order_by('-created_at')
        )
        current_revision_id = rows[0].id if rows else None
        payload = [
            {
                'history_id': row.id,
                'culture_id': row.object_id,
                'history_date': row.created_at,
                'history_type': 'snapshot',
                'history_user': row.user_name or None,
                'summary': ', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot',
                'object_type': 'culture',
                'object_display_name': row.display_name or None,
                'action': row.action,
                'actor_label': row.user_name or None,
                'is_current_version': row.id == current_revision_id,
                'changes': _build_entity_revision_changes(
                    row.snapshot,
                    rows[index + 1].snapshot if index + 1 < len(rows) else None,
                    row.changed_fields,
                ),
            }
            for index, row in enumerate(rows)
        ]
        return Response(CultureHistoryEntrySerializer(payload, many=True).data)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        lookup_value = self.kwargs.get(self.lookup_field, pk)
        culture = get_object_or_404(Culture.all_objects.all(), pk=lookup_value)
        serializer = CultureRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(
            EntityRevision.objects.filter(project_id=culture.project_id, entity_type='culture', object_id=culture.pk),
            id=revision_id,
        )
        snapshot = revision.snapshot
        allowed_fields = {f.name for f in Culture._meta.fields if f.name not in {'id', 'created_at', 'updated_at'}}

        with transaction.atomic():
            for key, value in snapshot.items():
                if key in allowed_fields:
                    setattr(culture, key, value)
            culture.deleted_at = None
            culture._history_action = EntityRevision.ACTION_RESTORED
            culture.save()
        self._set_latest_revision_actor(culture)

        return Response(self.get_serializer(culture).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='publish-public')
    def publish_public(self, request, pk=None):
        culture = self.get_object()
        if not culture.name.strip():
            return Response({'detail': 'Name is required for publishing.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            public_culture, duplicates, operation = publish_culture_to_public_library(culture=culture, user=request.user)
        except DuplicatePublicCultureError as error:
            return Response({
                'code': 'duplicate_public_culture',
                'detail': 'A similar public culture already exists.',
                'duplicates': [
                    {
                        'id': item.id,
                        'name': item.name,
                        'variety': item.variety,
                        'version': item.version,
                        'published_at': item.published_at,
                        'created_by_label': item.created_by_label,
                    }
                    for item in error.duplicates
                ],
                'normalized_identity': error.normalized_identity,
            }, status=status.HTTP_409_CONFLICT)
        serializer = PublicCultureSerializer(public_culture)
        return Response({
            'operation': operation,
            'public_culture': serializer.data,
            'duplicates': [
                {
                    'id': item.id,
                    'name': item.name,
                    'variety': item.variety,
                    'version': item.version,
                    'published_at': item.published_at,
                    'created_by_label': item.created_by_label,
                }
                for item in duplicates
            ],
        }, status=status.HTTP_201_CREATED)



class CultureSupplierDataViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    queryset = CultureSupplierData.objects.select_related('culture', 'supplier')
    serializer_class = CultureSupplierDataSerializer

    def get_queryset(self):
        return self.queryset.filter(project=self.request.active_project)

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        instance = serializer.save()
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def perform_destroy(self, instance):
        instance_id = instance.pk
        snapshot = _serialize_instance(instance)
        display_name = _entity_display_name(instance)
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=instance_id, snapshot=snapshot, display_name=display_name, changed_fields=[],
        )


class PublicCultureViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only public library for published cultures with project import action.

    Candidate for extraction into a separate service consumed by OFP over an
    API (under discussion as of 2026-07) — avoid deepening its coupling to
    project-scoped concerns like EntityRevision/history.
    """

    queryset = PublicCulture.objects.filter(status=PublicCulture.STATUS_PUBLISHED).order_by('name', 'variety')
    serializer_class = PublicCultureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = (self.request.query_params.get('q') or '').strip()
        name = (self.request.query_params.get('name') or '').strip()
        variety = (self.request.query_params.get('variety') or '').strip()

        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(variety__icontains=query))
        if name:
            queryset = queryset.filter(name__icontains=name)
        if variety:
            queryset = queryset.filter(variety__icontains=variety)
        return queryset

    @action(detail=False, methods=['get'], url_path='match')
    def match(self, request):
        """Check whether an exact normalized public culture match exists."""
        from .utils import normalize_text

        normalized_name = normalize_text(request.query_params.get('name'))
        normalized_variety = normalize_text(request.query_params.get('variety'))
        if not normalized_name or not normalized_variety:
            return Response({'exists': False, 'culture': None})

        culture = self.queryset.filter(
            name_normalized=normalized_name,
            variety_normalized=normalized_variety,
        ).only('id', 'name', 'variety', 'published_at').order_by('-published_at', '-id').first()
        if culture is None:
            return Response({'exists': False, 'culture': None})

        return Response({
            'exists': True,
            'culture': {
                'id': culture.id,
                'name': culture.name,
                'variety': culture.variety,
            },
        })

    @action(detail=True, methods=['post'], url_path='import')
    def import_to_project(self, request, pk=None):
        public_culture = self.get_object()
        request.active_project = get_active_project_or_400(request)
        imported = import_public_culture_into_project(public_culture=public_culture, project=request.active_project)
        serializer = CultureSerializer(imported)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SeedPackageViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    queryset = SeedPackage.objects.select_related('culture').all().order_by('size_unit', 'size_value')
    serializer_class = SeedPackageSerializer

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        instance = serializer.save()
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def perform_destroy(self, instance):
        package_id = instance.pk
        snapshot = _serialize_instance(instance)
        display_name = _entity_display_name(instance)
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=package_id, snapshot=snapshot, display_name=display_name, changed_fields=[],
        )

class PlantingPlanViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for PlantingPlan model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for planting plans. The harvest_date is automatically calculated
    on creation and update based on the culture's growth_duration_days.
    
    Attributes:
        queryset: All PlantingPlan objects ordered by planting_date (descending)
        serializer_class: PlantingPlanSerializer for serialization
    """
    queryset = (
        PlantingPlan.objects
        .select_related('culture', 'bed', 'created_by', 'updated_by')
        .annotate(note_attachment_count=Count('attachments'))
        .order_by('-planting_date')
    )
    serializer_class = PlantingPlanSerializer

    def perform_create(self, serializer):
        current_user = self.request.user if self.request.user.is_authenticated else None
        instance = serializer.save(created_by=current_user, updated_by=current_user, project=self.request.active_project)
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        current_user = self.request.user if self.request.user.is_authenticated else None
        previous_snapshot = _serialize_instance(serializer.instance)
        instance = serializer.save(updated_by=current_user)
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def perform_destroy(self, instance):
        instance_id = instance.pk
        snapshot = _serialize_instance(instance)
        display_name = _entity_display_name(instance)
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=instance_id, snapshot=snapshot, display_name=display_name, changed_fields=[],
        )


    @action(detail=False, methods=['get'], url_path='remaining-area')
    def remaining_area(self, request):
        """Calculate remaining bed area for a time interval.

        :param request: DRF request with bed_id, start_date, end_date and optional exclude_plan_id.
        :return: Remaining area payload for the requested bed and interval.
        """
        active_project = request.active_project
        bed_id_param = request.query_params.get('bed_id')
        start_date_param = request.query_params.get('start_date')
        end_date_param = request.query_params.get('end_date')
        exclude_plan_id_param = request.query_params.get('exclude_plan_id')

        if not bed_id_param or not start_date_param or not end_date_param:
            return Response(
                {'detail': 'bed_id, start_date and end_date are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            bed_id = int(bed_id_param)
        except ValueError:
            return Response({'detail': 'bed_id must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date = parse_date(start_date_param)
        end_date = parse_date(end_date_param)
        if start_date is None or end_date is None:
            return Response(
                {'detail': 'start_date and end_date must use YYYY-MM-DD format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exclude_plan_id: int | None = None
        if exclude_plan_id_param:
            try:
                exclude_plan_id = int(exclude_plan_id_param)
            except ValueError:
                return Response(
                    {'detail': 'exclude_plan_id must be an integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        bed = Bed.objects.filter(id=bed_id, project=active_project).only('id').first()
        if bed is None:
            return Response({'detail': 'Bed not found.'}, status=status.HTTP_404_NOT_FOUND)

        if exclude_plan_id is not None:
            plan_exists = PlantingPlan.objects.filter(id=exclude_plan_id, project=active_project).exists()
            if not plan_exists:
                return Response({'detail': 'exclude_plan_id not found in active project.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = calculate_remaining_bed_area(
                bed_id=bed_id,
                start_date=start_date,
                end_date=end_date,
                exclude_plan_id=exclude_plan_id,
            )
        except ValueError as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except Bed.DoesNotExist:
            return Response({'detail': 'Bed not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'bed_id': payload['bed_id'],
            'bed_area_sqm': float(payload['bed_area_sqm']),
            'overlapping_used_area_sqm': float(payload['overlapping_used_area_sqm']),
            'remaining_area_sqm': float(payload['remaining_area_sqm']),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        })

class TaskViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Task model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for farm management tasks.
    
    Attributes:
        queryset: All Task objects ordered by due_date and created_at
        serializer_class: TaskSerializer for serialization
    """
    queryset = Task.objects.select_related('planting_plan', 'planting_plan__culture', 'planting_plan__bed').all()
    serializer_class = TaskSerializer

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        instance = serializer.save()
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def perform_destroy(self, instance):
        instance_id = instance.pk
        snapshot = _serialize_instance(instance)
        title = getattr(instance, 'title', None)
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=instance_id, snapshot=snapshot, display_name=title, changed_fields=[],
        )






class CultureUndeleteView(APIView):
    """Undelete a soft-deleted culture by ID."""

    def post(self, request, pk: int):
        active_project = get_active_project_or_400(request)
        culture = get_object_or_404(Culture.all_objects.filter(project=active_project), pk=pk)
        culture.deleted_at = None
        culture._history_action = EntityRevision.ACTION_RESTORED
        culture.save()
        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id).update(orphaned_at=None)
        return Response(CultureSerializer(culture).data, status=status.HTTP_200_OK)


class ProjectHistoryListView(APIView):
    """List recent per-entity revisions across the whole project."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        since = timezone.now() - timedelta(days=30)
        rows = EntityRevision.objects.filter(project=active_project, created_at__gte=since).order_by('-created_at')
        payload = [
            {
                'history_id': row.id,
                'history_date': row.created_at,
                'history_type': 'project_snapshot',
                'history_user': row.user_name or None,
                'summary': f'{row.entity_type} {row.action} #{row.object_id}',
                'object_type': row.entity_type,
                'object_display_name': row.display_name or None,
                'action': row.action,
                'actor_label': row.user_name or None,
            }
            for row in rows
        ]
        return Response(CultureHistoryEntrySerializer(payload, many=True).data)


class ProjectHistoryRestoreView(APIView):
    """Restore whole project state to a past point in time."""

    def post(self, request):
        active_project = get_active_project_or_400(request)
        require_project_admin(request.user, active_project.id, request=request)
        serializer = CultureRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(EntityRevision.objects.filter(project=active_project), id=revision_id)
        _restore_project_state_at(active_project, revision.created_at)
        record_entity_revision(
            project=active_project,
            entity_type='project',
            object_id=active_project.id,
            action=EntityRevision.ACTION_RESTORED,
            snapshot={},
            display_name=active_project.name,
            changed_fields=[],
            user_name=_current_actor_label(request),
        )

        return Response({'detail': 'Project restored successfully.'}, status=status.HTTP_200_OK)


class GlobalHistoryListView(APIView):
    """List recent history entries across all cultures."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        since = timezone.now() - timedelta(days=30)
        rows = list(
            EntityRevision.objects
            .filter(project=active_project, entity_type='culture', created_at__gte=since)
            .order_by('-created_at')
        )
        current_revision_id = rows[0].id if rows else None
        payload = [
            {
                'history_id': row.id,
                'culture_id': row.object_id,
                'history_date': row.created_at,
                'history_type': 'snapshot',
                'history_user': row.user_name or None,
                'summary': f"Culture #{row.object_id}: " + (', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot'),
                'object_type': 'culture',
                'object_display_name': row.display_name or None,
                'action': row.action,
                'actor_label': row.user_name or None,
                'is_current_version': row.id == current_revision_id,
                'changes': _build_entity_revision_changes(
                    row.snapshot,
                    next(
                        (candidate.snapshot for candidate in rows[index + 1:] if candidate.object_id == row.object_id),
                        None,
                    ),
                    row.changed_fields,
                ),
            }
            for index, row in enumerate(rows)
        ]
        return Response(CultureHistoryEntrySerializer(payload, many=True).data)


class GlobalHistoryRestoreView(APIView):
    """Restore a culture from a global history entry (supports soft-deleted cultures)."""

    def post(self, request):
        active_project = get_active_project_or_400(request)
        require_project_admin(request.user, active_project.id, request=request)
        serializer = CultureRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(
            EntityRevision.objects.filter(project=active_project, entity_type='culture'),
            id=revision_id,
        )
        culture = get_object_or_404(Culture.all_objects.filter(project=active_project), pk=revision.object_id)
        snapshot = revision.snapshot
        allowed_fields = {f.name for f in Culture._meta.fields if f.name not in {'id', 'created_at', 'updated_at'}}

        with transaction.atomic():
            for key, value in snapshot.items():
                if key in allowed_fields:
                    setattr(culture, key, value)
            culture.deleted_at = None
            culture._history_action = EntityRevision.ACTION_RESTORED
            culture.save()

        return Response(CultureSerializer(culture).data, status=status.HTTP_200_OK)


class MediaFileUploadView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        active_project = get_active_project_or_400(request)
        upload = request.FILES.get('file')
        if upload is None:
            return Response({'file': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_MEDIA_UPLOAD_BYTES:
            return Response({'file': ['File is too large. Maximum allowed size is 10 MB.']}, status=status.HTTP_400_BAD_REQUEST)
        content_type = (getattr(upload, 'content_type', '') or '').lower()
        if content_type not in ALLOWED_MEDIA_UPLOAD_CONTENT_TYPES:
            return Response({'file': ['Unsupported file type. Only image uploads are allowed.']}, status=status.HTTP_400_BAD_REQUEST)

        rel_path = culture_media_upload_path(None, upload.name)
        saved_path = default_storage.save(rel_path, upload)
        media = MediaFile.objects.create(storage_path=saved_path)
        record_entity_revision(
            project=active_project,
            entity_type='media_file',
            object_id=media.pk,
            action=EntityRevision.ACTION_CREATED,
            snapshot=_serialize_instance(media),
            user_name=_current_actor_label(request),
        )
        return Response({'id': media.id, 'storage_path': media.storage_path, 'uploaded_at': media.uploaded_at}, status=status.HTTP_201_CREATED)

class NoteAttachmentListCreateView(APIView):
    """List and upload image attachments for a planting plan note."""

    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get(self, request, note_id: int):
        active_project = get_active_project_or_400(request)
        plan = get_object_or_404(PlantingPlan, pk=note_id, project=active_project)
        attachments = plan.attachments.all()
        serializer = NoteAttachmentSerializer(attachments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, note_id: int):
        active_project = get_active_project_or_400(request)
        plan = get_object_or_404(PlantingPlan, pk=note_id, project=active_project)

        if plan.attachments.count() >= 10:
            return Response({'detail': 'Attachment limit per note reached (10).'}, status=status.HTTP_400_BAD_REQUEST)

        upload = request.FILES.get('image')
        if upload is None:
            return Response({'image': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        caption = request.data.get('caption', '')

        try:
            content, metadata = process_note_image(upload)
        except ImageProcessingBackendUnavailableError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ImageProcessingError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        attachment = NoteAttachment(
            planting_plan=plan,
            caption=caption,
            created_by=request.user if request.user.is_authenticated else None,
            updated_by=request.user if request.user.is_authenticated else None,
            project=plan.project,
            width=metadata['width'],
            height=metadata['height'],
            size_bytes=metadata['size_bytes'],
            mime_type=metadata['mime_type'],
        )
        attachment.image.save(str(metadata.get('filename', 'processed.webp')), content, save=False)
        attachment.save()

        serializer = NoteAttachmentSerializer(attachment, context={'request': request})
        record_entity_revision(
            project=attachment.project,
            entity_type='note_attachment',
            object_id=attachment.pk,
            action=EntityRevision.ACTION_CREATED,
            snapshot=_serialize_instance(attachment),
            user_name=_current_actor_label(request),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NoteAttachmentDeleteView(APIView):
    """Delete a note attachment."""

    def delete(self, request, attachment_id: int):
        active_project = get_active_project_or_400(request)
        attachment = get_object_or_404(NoteAttachment, pk=attachment_id, project=active_project)
        attachment_id = attachment.pk
        attachment_project = attachment.project
        snapshot = _serialize_instance(attachment)
        attachment.image.delete(save=False)
        attachment.delete()
        record_entity_revision(
            project=attachment_project,
            entity_type='note_attachment',
            object_id=attachment_id,
            action=EntityRevision.ACTION_DELETED,
            snapshot=snapshot,
            changed_fields=[],
            user_name=_current_actor_label(request),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class SeedDemandListView(ProjectScopedMixin, generics.ListAPIView):
    """Read-only endpoint returning typed seed demand aggregated by culture."""

    serializer_class = SeedDemandSerializer
    REQUIRED_AMOUNT_WARNING_MISSING_TKG = 'missing_tkg'

    @staticmethod
    def _parse_selected_suppliers(raw_value: str | None) -> dict[int, int]:
        selected: dict[int, int] = {}
        if not raw_value:
            return selected
        for item in raw_value.split(','):
            if ':' not in item:
                continue
            culture_raw, supplier_raw = item.split(':', 1)
            try:
                culture_id = int(culture_raw.strip())
                supplier_id = int(supplier_raw.strip())
            except (TypeError, ValueError):
                continue
            if culture_id > 0 and supplier_id > 0:
                selected[culture_id] = supplier_id
        return selected

    @staticmethod
    def _select_seed_rate(culture: Culture, cultivation_type: str | None) -> tuple[Decimal | None, str | None]:
        active_types = set(culture.cultivation_types or [])
        if cultivation_type and active_types and cultivation_type not in active_types:
            return None, None
        if cultivation_type == 'direct_sowing' and culture.seed_rate_direct_value is not None and culture.seed_rate_direct_unit:
            return Decimal(str(culture.seed_rate_direct_value)), culture.seed_rate_direct_unit
        if cultivation_type == 'pre_cultivation' and culture.seed_rate_pre_cultivation_value is not None and culture.seed_rate_pre_cultivation_unit:
            return Decimal(str(culture.seed_rate_pre_cultivation_value)), culture.seed_rate_pre_cultivation_unit
        if cultivation_type and isinstance(culture.seed_rate_by_cultivation, dict):
            payload = culture.seed_rate_by_cultivation.get(cultivation_type)
            if isinstance(payload, dict):
                value = payload.get('value')
                unit = payload.get('unit')
                if isinstance(value, (int, float, str)) and unit:
                    return Decimal(str(value)), str(unit)
        if culture.seed_rate_value is None or not culture.seed_rate_unit:
            return None, None
        return Decimal(str(culture.seed_rate_value)), culture.seed_rate_unit

    @staticmethod
    def _select_safety_margin_percent(culture: Culture, cultivation_type: str | None) -> Decimal:
        active_types = set(culture.cultivation_types or [])
        if cultivation_type and active_types and cultivation_type not in active_types:
            return Decimal('0')
        if cultivation_type == 'direct_sowing' and culture.sowing_calculation_safety_percent_direct is not None:
            return Decimal(str(culture.sowing_calculation_safety_percent_direct))
        if cultivation_type == 'pre_cultivation' and culture.sowing_calculation_safety_percent_pre_cultivation is not None:
            return Decimal(str(culture.sowing_calculation_safety_percent_pre_cultivation))
        return Decimal(str(culture.sowing_calculation_safety_percent or 0))

    @staticmethod
    def _convert_requirement_to_unit(*, requirement_value: Decimal, requirement_unit: str, target_unit: str, tkg: Decimal | None) -> tuple[Decimal | None, str | None]:
        if requirement_unit == target_unit:
            return requirement_value, None
        if not tkg or tkg <= 0:
            return None, 'Missing thousand-kernel weight for unit conversion.'
        if requirement_unit == SEED_PACKAGE_UNIT_SEEDS and target_unit == SEED_PACKAGE_UNIT_GRAMS:
            return (requirement_value * tkg) / Decimal('1000'), None
        if requirement_unit == SEED_PACKAGE_UNIT_GRAMS and target_unit == SEED_PACKAGE_UNIT_SEEDS:
            return (requirement_value / tkg) * Decimal('1000'), None
        return None, 'Cannot convert between required amount and package unit.'

    @classmethod
    def _get_required_amount_in_unit(
        cls,
        *,
        amounts_by_unit: dict[str, Decimal],
        target_unit: str,
        tkg: Decimal | None,
    ) -> tuple[Decimal | None, str | None]:
        total = amounts_by_unit.get(target_unit, Decimal('0'))
        for source_unit, source_amount in amounts_by_unit.items():
            if source_unit == target_unit or source_amount <= 0:
                continue
            converted, conversion_warning = cls._convert_requirement_to_unit(
                requirement_value=source_amount,
                requirement_unit=source_unit,
                target_unit=target_unit,
                tkg=tkg,
            )
            if converted is None:
                if {source_unit, target_unit} == {SEED_PACKAGE_UNIT_SEEDS, SEED_PACKAGE_UNIT_GRAMS}:
                    return None, cls.REQUIRED_AMOUNT_WARNING_MISSING_TKG
                return None, conversion_warning
            total += converted
        return total, None

    @staticmethod
    def _select_tkg(culture_tkg: Decimal | None, selected_supplier: CultureSupplierData | None) -> Decimal | None:
        if selected_supplier and selected_supplier.thousand_kernel_weight_g:
            return Decimal(str(selected_supplier.thousand_kernel_weight_g))
        return culture_tkg

    def _compute_plan_requirement(self, plan: PlantingPlan) -> tuple[Decimal | None, str | None]:
        value, unit = self._select_seed_rate(plan.culture, plan.cultivation_type)
        if value is None or not unit or value <= 0:
            return None, 'Missing seed rate value or unit.'

        area = Decimal(str(plan.area_usage_sqm or 0))
        quantity = Decimal(str(plan.quantity or 0))
        row_spacing = Decimal(str(plan.culture.row_spacing_m or 0))

        if unit in {SEED_RATE_UNIT_G_PER_M2, SEED_RATE_UNIT_SEEDS_PER_M2}:
            if area <= 0:
                return None, 'Missing area usage for m²-based seed requirement.'
            amount_unit = SEED_PACKAGE_UNIT_GRAMS if unit == SEED_RATE_UNIT_G_PER_M2 else SEED_PACKAGE_UNIT_SEEDS
            return area * value, amount_unit

        if unit in {SEED_RATE_UNIT_G_PER_LFM, SEED_RATE_UNIT_SEEDS_PER_LFM}:
            if row_spacing <= 0:
                return None, 'Missing row spacing for lfm-based seed requirement.'
            if area <= 0:
                return None, 'Missing area usage for lfm-based seed requirement.'
            lfm = area / row_spacing
            amount_unit = SEED_PACKAGE_UNIT_GRAMS if unit == SEED_RATE_UNIT_G_PER_LFM else SEED_PACKAGE_UNIT_SEEDS
            return lfm * value, amount_unit

        if unit == SEED_RATE_UNIT_SEEDS_PER_PLANT:
            if quantity <= 0:
                return None, 'Missing plant quantity for seeds-per-plant requirement.'
            return quantity * value, 'seeds'

        return None, 'Unsupported seed rate unit.'

    def list(self, request, *args, **kwargs):
        plans = (
            PlantingPlan.objects
            .filter(project=request.active_project)
            .select_related('culture', 'culture__supplier', 'culture__selected_seed_demand_supplier')
            .order_by('culture__name', 'culture__variety')
        )
        grouped: dict[int, dict] = {}
        for plan in plans:
            culture = plan.culture
            entry = grouped.setdefault(
                culture.id,
                {
                    'culture_id': culture.id,
                    'culture_name': culture.name,
                    'variety': culture.variety,
                    'supplier': culture.supplier.name if culture.supplier else (culture.seed_supplier or ''),
                    'required_amount_by_unit': {
                        SEED_PACKAGE_UNIT_GRAMS: Decimal('0'),
                        SEED_PACKAGE_UNIT_SEEDS: Decimal('0'),
                    },
                    'warning': None,
                    'tkg': Decimal(str(culture.thousand_kernel_weight_g)) if culture.thousand_kernel_weight_g else None,
                    'culture': culture,
                },
            )
            if entry['warning']:
                continue
            requirement_value, requirement_unit = self._compute_plan_requirement(plan)
            if requirement_value is None or not requirement_unit:
                entry['warning'] = requirement_unit or 'Seed requirement could not be calculated.'
                continue
            margin_factor = Decimal('1') + (
                self._select_safety_margin_percent(culture, plan.cultivation_type) / Decimal('100')
            )
            entry['required_amount_by_unit'][requirement_unit] += requirement_value * margin_factor

        culture_ids = list(grouped.keys())
        selected_supplier_by_culture = self._parse_selected_suppliers(request.query_params.get('supplier_selection'))
        supplier_rows = (
            CultureSupplierData.objects
            .filter(project=request.active_project, culture_id__in=culture_ids)
            .select_related('supplier')
            .order_by('culture_id', 'supplier__name')
        )
        suppliers_map: dict[int, list[CultureSupplierData]] = defaultdict(list)
        for row in supplier_rows:
            suppliers_map[row.culture_id].append(row)
        rows: list[dict] = []
        for culture_id, entry in grouped.items():
            required_amounts_by_unit = entry['required_amount_by_unit']
            has_required_amount = any(amount > 0 for amount in required_amounts_by_unit.values())
            warning = entry['warning']
            culture = entry['culture']
            supplier_options = suppliers_map.get(culture_id, [])
            selected_supplier = None
            selected_supplier_id = selected_supplier_by_culture.get(culture_id)
            if selected_supplier_id is None:
                selected_supplier_id = culture.selected_seed_demand_supplier_id
            if selected_supplier_id:
                selected_supplier = next((item for item in supplier_options if item.supplier_id == selected_supplier_id), None)
            if selected_supplier is None and len(supplier_options) == 1:
                selected_supplier = supplier_options[0]
                selected_supplier_id = selected_supplier.supplier_id

            selected_tkg = self._select_tkg(entry['tkg'], selected_supplier)
            display_required_amount, required_amount_warning = self._get_required_amount_in_unit(
                amounts_by_unit=required_amounts_by_unit,
                target_unit=SEED_PACKAGE_UNIT_GRAMS,
                tkg=selected_tkg,
            )
            packages_raw = selected_supplier.packaging_sizes if selected_supplier else []
            packages = []
            for item in packages_raw or []:
                if not isinstance(item, dict):
                    continue
                size_value = item.get('size_value')
                size_unit = item.get('size_unit')
                if not isinstance(size_value, (int, float)) or size_unit not in {SEED_PACKAGE_UNIT_GRAMS, SEED_PACKAGE_UNIT_SEEDS}:
                    continue
                packages.append({'size_value': float(size_value), 'size_unit': size_unit})
            row = {
                'culture_id': entry['culture_id'],
                'culture_name': entry['culture_name'],
                'variety': entry['variety'],
                'supplier': (
                    selected_supplier.supplier.name
                    if selected_supplier and selected_supplier.supplier
                    else (selected_supplier.supplier_name if selected_supplier else '')
                ),
                'selected_supplier_id': selected_supplier.supplier_id if selected_supplier else None,
                'supplier_options': [
                    {
                        'supplier_id': item.supplier_id,
                        'supplier_name': item.supplier.name if item.supplier else item.supplier_name,
                    }
                    for item in supplier_options
                ],
                'required_amount_value': (
                    float(display_required_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                    if display_required_amount is not None
                    else None
                ),
                'required_amount_unit': SEED_PACKAGE_UNIT_GRAMS if has_required_amount else None,
                'required_amount_warning': required_amount_warning,
                'total_grams': (
                    float(display_required_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                    if display_required_amount is not None
                    else None
                ),
                'seed_packages': packages,
                'package_suggestion': None,
                'packages_needed': None,
                'warning': warning,
            }
            if not supplier_options:
                row['warning'] = row['warning'] or 'Keine Lieferantendaten vorhanden.'

            if warning or not has_required_amount:
                rows.append(row)
                continue

            if not packages:
                rows.append(row)
                continue

            target_unit = (
                SEED_PACKAGE_UNIT_GRAMS
                if any(pkg['size_unit'] == SEED_PACKAGE_UNIT_GRAMS for pkg in packages)
                else packages[0]['size_unit']
            )
            same_unit_packages = [pkg for pkg in packages if pkg['size_unit'] == target_unit]
            target_amount, conversion_warning = self._get_required_amount_in_unit(
                amounts_by_unit=required_amounts_by_unit,
                target_unit=target_unit,
                tkg=selected_tkg,
            )
            if target_amount is None:
                row['warning'] = conversion_warning or 'Cannot convert required amount to package units.'
                rows.append(row)
                continue

            suggestion = compute_seed_package_suggestion(
                required_amount=target_amount,
                packages=[PackageOption(size_value=Decimal(str(pkg['size_value'])), size_unit=pkg['size_unit']) for pkg in same_unit_packages],
                unit=target_unit,
            )
            if suggestion.pack_count > 0:
                row['package_suggestion'] = {
                    'selection': [
                        {
                            'size_value': float(item.size_value),
                            'size_unit': item.size_unit,
                            'count': item.count,
                        }
                        for item in suggestion.selection
                    ],
                    'total_amount': float(suggestion.total_amount),
                    'overage': float(suggestion.overage),
                    'pack_count': suggestion.pack_count,
                    'unit': target_unit,
                }
                row['packages_needed'] = suggestion.pack_count
            rows.append(row)

        rows.sort(key=lambda item: (item['culture_name'] or '', item['variety'] or ''))
        serializer = self.get_serializer(rows, many=True)
        return Response({'count': len(rows), 'next': None, 'previous': None, 'results': serializer.data})

    def post(self, request, *args, **kwargs):
        culture_id = request.data.get('culture_id')
        supplier_id = request.data.get('supplier_id')
        try:
            culture_id = int(culture_id)
        except (TypeError, ValueError):
            return Response({'detail': 'culture_id must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)
        if culture_id <= 0:
            return Response({'detail': 'culture_id must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)

        culture = get_object_or_404(Culture, id=culture_id, project=request.active_project)

        if supplier_id in (None, ''):
            culture.selected_seed_demand_supplier = None
            culture.save(update_fields=['selected_seed_demand_supplier', 'updated_at'])
            return Response({'culture_id': culture.id, 'selected_supplier_id': None}, status=status.HTTP_200_OK)

        try:
            supplier_id = int(supplier_id)
        except (TypeError, ValueError):
            return Response({'detail': 'supplier_id must be an integer or null.'}, status=status.HTTP_400_BAD_REQUEST)

        supplier = get_object_or_404(Supplier, id=supplier_id, project=request.active_project)
        has_supplier_data = CultureSupplierData.objects.filter(
            project=request.active_project,
            culture=culture,
            supplier=supplier,
        ).exists()
        if not has_supplier_data:
            return Response({'detail': 'Supplier is not available for this culture.'}, status=status.HTTP_400_BAD_REQUEST)

        culture.selected_seed_demand_supplier = supplier
        culture.save(update_fields=['selected_seed_demand_supplier', 'updated_at'])
        return Response({'culture_id': culture.id, 'selected_supplier_id': supplier.id}, status=status.HTTP_200_OK)

class MyProjectsView(APIView):
    """Return all projects for current user with membership metadata."""

    def get(self, request):
        agent_mode = bool(request.session.get('agent_mode'))
        agent_project_id = request.session.get('agent_project_id')
        settings_obj, _ = UserProjectSettings.objects.get_or_create(user=request.user)

        if agent_mode and agent_project_id is not None:
            try:
                bound_project_id = int(agent_project_id)
            except (TypeError, ValueError):
                return Response({'detail': 'Invalid agent project binding.'}, status=status.HTTP_403_FORBIDDEN)

            project = get_object_or_404(Project, id=bound_project_id, is_active=True, deleted_at__isnull=True)
            return Response([
                {
                    'project': ProjectSerializer(project).data,
                    'role': ProjectMembership.ROLE_MEMBER,
                    'is_default': settings_obj.default_project_id == project.id,
                    'is_last': settings_obj.last_project_id == project.id,
                }
            ])

        memberships = ProjectMembership.objects.select_related('project').filter(
            user=request.user,
            project__is_active=True,
            project__deleted_at__isnull=True,
        )
        payload = []
        for membership in memberships:
            project = membership.project
            payload.append(
                {
                    'project': ProjectSerializer(project).data,
                    'role': membership.role,
                    'is_default': settings_obj.default_project_id == project.id,
                    'is_last': settings_obj.last_project_id == project.id,
                }
            )
        return Response(payload)


class ProjectSwitchView(APIView):
    """Switch active project for current user and persist last project."""

    def post(self, request):
        project_id = request.data.get('project_id')
        try:
            project_id = int(project_id)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid project_id.'}, status=status.HTTP_400_BAD_REQUEST)

        membership = ProjectMembership.objects.filter(
            user=request.user,
            project_id=project_id,
            project__is_active=True,
            project__deleted_at__isnull=True,
        ).first()
        if membership is None:
            return Response({'detail': 'Not a member of the selected project.'}, status=status.HTTP_403_FORBIDDEN)

        settings_obj, _ = UserProjectSettings.objects.get_or_create(user=request.user)
        settings_obj.last_project_id = project_id
        update_fields = ['last_project', 'updated_at']
        if request.data.get('set_default') is True:
            settings_obj.default_project_id = project_id
            update_fields.append('default_project')
        settings_obj.save(update_fields=update_fields)

        active_project, _ = resolve_project_for_user(request.user)
        return Response({
            'detail': 'Project switched.',
            'project_id': project_id,
            'resolved_project_id': active_project.id if active_project else None,
            'last_project_id': settings_obj.last_project_id,
            'default_project_id': settings_obj.default_project_id,
        })


class ProjectViewSet(viewsets.ModelViewSet):
    """Project CRUD for authenticated users."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProjectSerializer
    queryset = Project.objects.filter(is_active=True, deleted_at__isnull=True)

    def get_queryset(self):
        queryset = Project.objects.filter(memberships__user=self.request.user, is_active=True).distinct()
        if self.request.query_params.get('deleted') in {'1', 'true', 'True'}:
            return queryset.filter(
                memberships__role=ProjectMembership.ROLE_ADMIN,
                deleted_at__isnull=False,
            )
        return queryset.filter(deleted_at__isnull=True)

    def perform_create(self, serializer):
        project = serializer.save(slug=_build_unique_project_slug(serializer.validated_data['name']))
        if not Location.objects.filter(project=project).exists():
            Location.objects.create(
                project=project,
                name='Hauptstandort',
            )
        ProjectMembership.objects.get_or_create(
            user=self.request.user,
            project=project,
            defaults={'role': ProjectMembership.ROLE_ADMIN},
        )
        settings_obj, _ = UserProjectSettings.objects.get_or_create(user=self.request.user)
        if settings_obj.default_project_id is None:
            settings_obj.default_project = project
        settings_obj.last_project = project
        settings_obj.save()

    def destroy(self, request: Request, *args: object, **kwargs: object) -> Response:
        project = self.get_object()
        require_project_admin(request.user, project.id, request)
        project.deleted_at = timezone.now()
        project.save(update_fields=['deleted_at', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def restore(self, request: Request, pk: str | None = None) -> Response:
        project = get_object_or_404(
            Project.objects.filter(
                memberships__user=request.user,
                is_active=True,
                deleted_at__isnull=False,
            ),
            pk=pk,
        )
        require_project_admin(request.user, project.id, request)
        project.deleted_at = None
        project.save(update_fields=['deleted_at', 'updated_at'])
        return Response(ProjectSerializer(project).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'])
    def permanent(self, request: Request, pk: str | None = None) -> Response:
        project = get_object_or_404(
            Project.objects.filter(
                memberships__user=request.user,
                deleted_at__isnull=False,
            ),
            pk=pk,
        )
        require_project_admin(request.user, project.id, request)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectMembersView(APIView):
    """List and mutate project memberships."""

    def get(self, request, project_id: int):
        project = get_object_or_404(Project, id=project_id, is_active=True, deleted_at__isnull=True)
        memberships = ProjectMembership.objects.select_related('user').filter(project=project, user__is_active=True)
        if not memberships.filter(user=request.user).exists():
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(ProjectMembershipSerializer(memberships, many=True).data)

    def patch(self, request, project_id: int):
        get_object_or_404(Project, id=project_id, is_active=True, deleted_at__isnull=True)
        require_project_admin(request.user, project_id, request=request)
        membership_id = request.data.get('membership_id')
        role = request.data.get('role')
        membership = get_object_or_404(ProjectMembership, id=membership_id, project_id=project_id)
        if role not in {ProjectMembership.ROLE_ADMIN, ProjectMembership.ROLE_MEMBER}:
            return Response({'detail': 'Invalid role.'}, status=status.HTTP_400_BAD_REQUEST)
        if membership.user_id == request.user.id:
            return Response({'detail': 'You cannot change your own project role here.'}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == ProjectMembership.ROLE_ADMIN and role != ProjectMembership.ROLE_ADMIN:
            admin_count = ProjectMembership.objects.filter(project_id=project_id, role=ProjectMembership.ROLE_ADMIN).count()
            if admin_count <= 1:
                return Response({'detail': 'At least one project admin must remain.'}, status=status.HTTP_400_BAD_REQUEST)
        membership.role = role
        membership.save(update_fields=['role'])
        return Response(ProjectMembershipSerializer(membership).data)

    def delete(self, request, project_id: int):
        get_object_or_404(Project, id=project_id, is_active=True, deleted_at__isnull=True)
        require_project_admin(request.user, project_id, request=request)
        membership_id = request.data.get('membership_id')
        membership = get_object_or_404(ProjectMembership, id=membership_id, project_id=project_id)
        if membership.user_id == request.user.id:
            return Response({'detail': 'You cannot remove yourself from the project here.'}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == ProjectMembership.ROLE_ADMIN:
            admin_count = ProjectMembership.objects.filter(project_id=project_id, role=ProjectMembership.ROLE_ADMIN).count()
            if admin_count <= 1:
                return Response({'detail': 'At least one project admin must remain.'}, status=status.HTTP_400_BAD_REQUEST)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectInvitationView(APIView):
    """Create and list project invitations."""

    def get(self, request, project_id: int):
        get_object_or_404(Project, id=project_id, is_active=True, deleted_at__isnull=True)
        require_project_admin(request.user, project_id, request=request)
        invitations = ProjectInvitation.objects.filter(project_id=project_id).order_by('-created_at')
        return Response(ProjectInvitationSerializer(invitations, many=True).data)

    def post(self, request, project_id: int):
        require_project_admin(request.user, project_id, request=request)
        serializer = ProjectInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = get_object_or_404(Project, id=project_id, is_active=True, deleted_at__isnull=True)

        try:
            result = create_or_resend_invitation(
                project=project,
                invited_by=request.user,
                email=serializer.validated_data['email'],
                role=serializer.validated_data['role'],
            )
        except InvitationFlowError as exc:
            return _invitation_error_response(exc)

        invitation = result.invitation
        if invitation is None:
            return Response({'code': 'invitation_error', 'detail': 'Invitation could not be created.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        invite_link = build_public_frontend_url(f'/invite/accept?token={invitation.token}')
        mail_sent, mail_error = _send_project_invitation_email(
            invitation=invitation,
            project_name=project.name,
            invited_by=request.user,
        )

        payload = ProjectInvitationSerializer(invitation).data
        payload['code'] = result.code
        payload['mail_sent'] = mail_sent
        payload['invite_link'] = invite_link
        if not mail_sent and mail_error:
            payload['mail_error'] = mail_error
            payload['mail_error_code'] = 'email_send_failed'
        status_code = status.HTTP_201_CREATED if result.code == 'invitation_sent' else status.HTTP_200_OK
        return Response(payload, status=status_code)


class PublicProjectInvitationView(APIView):
    """Read public invitation status by token."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, token: str):
        try:
            invitation = get_invitation_by_token(token)
        except InvitationFlowError as exc:
            return Response({'code': exc.code, 'detail': exc.message}, status=status.HTTP_404_NOT_FOUND)

        if request.user.is_authenticated:
            clear_pending_invitation_token(session=request.session)
        elif invitation.is_open:
            store_pending_invitation_token(session=request.session, token=invitation.token)
        else:
            clear_pending_invitation_token(session=request.session)

        payload = build_public_status(invitation, request.user if request.user.is_authenticated else None)
        return Response(payload)


class PendingProjectInvitationView(APIView):
    """Read or clear the pending invitation token kept in the current session."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = get_pending_invitation_token(session=request.session)
        if token is None:
            return Response({'code': 'no_pending_invitation', 'requires_auth': not request.user.is_authenticated})

        try:
            invitation = get_invitation_by_token(token)
        except InvitationFlowError as exc:
            clear_pending_invitation_token(session=request.session)
            return _invitation_error_response(exc)

        payload = build_public_status(invitation, request.user if request.user.is_authenticated else None)
        return Response(payload)

    def delete(self, request):
        clear_pending_invitation_token(session=request.session)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcceptProjectInvitationByTokenView(APIView):
    """Accept invitation by token path parameter."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'invitation_accept'

    def post(self, request, token: str):
        logger.info('Invitation accept endpoint reached', extra={'user_id': request.user.id, 'path': request.path})
        try:
            invitation = get_invitation_by_token(token)
            result = accept_invitation(invitation=invitation, user=request.user)
        except InvitationFlowError as exc:
            logger.warning('Invitation accept failed', extra={'user_id': request.user.id, 'code': exc.code, 'path': request.path})
            return _invitation_error_response(exc)

        project_payload = _apply_invitation_project_settings(user=request.user, project=result.invitation.project)
        clear_pending_invitation_token(session=request.session)

        return Response(
            {
                'code': result.code,
                'detail': result.message,
                'project_id': result.invitation.project_id if result.invitation else None,
                'project': project_payload,
            }
        )


class AcceptProjectInvitationView(APIView):
    """Accept invitation token from request body for backward compatibility."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'invitation_accept'

    def post(self, request):
        serializer = InvitationTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token']
        logger.info('Invitation accept body endpoint reached', extra={'user_id': request.user.id, 'path': request.path})
        return AcceptProjectInvitationByTokenView().post(request, token)


class AcceptPendingProjectInvitationView(APIView):
    """Accept the invitation token currently stored in the session."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'invitation_accept'

    def post(self, request):
        logger.info('Pending invitation accept endpoint reached', extra={'user_id': request.user.id, 'path': request.path})
        try:
            result = accept_pending_invitation_from_session(session=request.session, user=request.user)
        except InvitationFlowError as exc:
            if exc.code == 'no_pending_invitation':
                return Response(
                    {
                        'code': exc.code,
                        'detail': exc.message,
                        'project_id': None,
                        'project': None,
                    }
                )
            logger.warning('Pending invitation accept failed', extra={'user_id': request.user.id, 'code': exc.code, 'path': request.path})
            return _invitation_error_response(exc)

        project_payload = _apply_invitation_project_settings(user=request.user, project=result.invitation.project)
        clear_pending_invitation_token(session=request.session)

        return Response(
            {
                'code': result.code,
                'detail': result.message,
                'project_id': result.invitation.project_id if result.invitation else None,
                'project': project_payload,
            }
        )


class RevokeProjectInvitationView(APIView):
    """Revoke open invitations as project admin."""

    def post(self, request, project_id: int, invitation_id: int):
        get_object_or_404(Project, id=project_id, is_active=True, deleted_at__isnull=True)
        require_project_admin(request.user, project_id, request=request)
        invitation = get_object_or_404(ProjectInvitation, id=invitation_id, project_id=project_id)
        result = revoke_invitation(invitation=invitation, actor=request.user)
        return Response({'code': result.code, 'detail': result.message})
        active_project = request.active_project
