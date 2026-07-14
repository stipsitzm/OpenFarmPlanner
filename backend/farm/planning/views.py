"""API endpoints for the planning domain (planting plans, tasks, yield calendar)."""

import logging
from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count
from django.utils.dateparse import parse_date
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from farm.common.mixins import ProjectRevisionMixin, ProjectScopedMixin
from farm.history import _entity_display_name, _serialize_instance
from farm.models import Bed, EntityRevision, PlantingPlan, Task
from farm.project_context import get_active_project_or_400
from farm.services_area import calculate_remaining_bed_area

from .serializers import PlantingPlanSerializer, TaskSerializer

logger = logging.getLogger(__name__)


def _week_start_for_iso_year(iso_year: int) -> date:
    """Return Monday of ISO week 1 for an ISO year."""
    return date.fromisocalendar(iso_year, 1, 1)


def _iso_week_key(day: date) -> str:
    """Return ISO week key in the format YYYY-Www using ISO year and week."""
    iso_year, iso_week, _ = day.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


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
