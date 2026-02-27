"""ViewSets for the farm app API endpoints.

This module provides RESTful API endpoints for all farm models using
Django REST Framework's ModelViewSet. Each ViewSet handles CRUD operations
for its respective model.
"""

from collections import defaultdict
import logging
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import json

from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Case, When, Value, F, FloatField, IntegerField, ExpressionWrapper, Sum, CharField, Q, Count
from django.db.models.functions import Coalesce, Ceil, Cast
from rest_framework import viewsets, status, generics, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.files.storage import default_storage
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from .models import Location, Field, Bed, Culture, PlantingPlan, Task, Supplier, NoteAttachment, MediaFile, SeedPackage, culture_media_upload_path, CultureRevision, ProjectRevision
from .serializers import (
    LocationSerializer,
    FieldSerializer,
    BedSerializer,
    CultureSerializer,
    PlantingPlanSerializer,
    TaskSerializer,
    SupplierSerializer,
    SeedDemandSerializer,
    NoteAttachmentSerializer,
    CultureHistoryEntrySerializer,
    CultureRestoreSerializer,
    SeedPackageSerializer,
)

from .services_area import calculate_remaining_bed_area

from .image_processing import (
    process_note_image,
    ImageProcessingError,
    ImageProcessingBackendUnavailableError,
)
from .services.enrichment import enrich_culture, EnrichmentError
from .services.seed_packages import PackageOption, compute_seed_package_suggestion


logger = logging.getLogger(__name__)


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


def _week_start_for_iso_year(iso_year: int) -> date:
    """Return Monday of ISO week 1 for an ISO year."""
    return date.fromisocalendar(iso_year, 1, 1)


def _iso_week_key(day: date) -> str:
    """Return ISO week key in the format YYYY-Www using ISO year and week."""
    iso_year, iso_week, _ = day.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def _serialize_project_state() -> dict[str, list[dict]]:
    """Serialize all major project entities to JSON-compatible dictionaries."""
    return {
        'locations': list(Location.objects.order_by('id').values()),
        'fields': list(Field.objects.order_by('id').values()),
        'beds': list(Bed.objects.order_by('id').values()),
        'suppliers': list(Supplier.objects.order_by('id').values()),
        'media_files': list(MediaFile.objects.order_by('id').values()),
        'cultures': list(Culture.all_objects.order_by('id').values()),
        'planting_plans': list(PlantingPlan.objects.order_by('id').values()),
        'tasks': list(Task.objects.order_by('id').values()),
        'note_attachments': list(NoteAttachment.objects.order_by('id').values()),
    }


def _create_project_revision(summary: str) -> None:
    snapshot = json.loads(json.dumps(_serialize_project_state(), cls=DjangoJSONEncoder))
    ProjectRevision.objects.create(snapshot=snapshot, summary=summary)


def _restore_project_state(snapshot: dict[str, list[dict]]) -> None:
    with transaction.atomic():
        Task.objects.all().delete()
        NoteAttachment.objects.all().delete()
        PlantingPlan.objects.all().delete()
        Culture.all_objects.all().delete()
        Bed.objects.all().delete()
        Field.objects.all().delete()
        Location.objects.all().delete()
        Supplier.objects.all().delete()
        MediaFile.objects.all().delete()

        for model, key in [
            (Location, 'locations'),
            (Field, 'fields'),
            (Bed, 'beds'),
            (Supplier, 'suppliers'),
            (MediaFile, 'media_files'),
            (Culture, 'cultures'),
            (PlantingPlan, 'planting_plans'),
            (Task, 'tasks'),
            (NoteAttachment, 'note_attachments'),
        ]:
            rows = snapshot.get(key, [])
            if not rows:
                continue
            model.objects.bulk_create([model(**row) for row in rows])



class YieldCalendarListView(generics.GenericAPIView):
    """Return expected yield distribution aggregated by ISO week and culture."""

    def get(self, request):
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
    """Create a project snapshot after mutating operations."""

    def create_project_revision(self, summary: str) -> None:
        _create_project_revision(summary)



class LocationViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Location model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for farm locations. All locations are returned without filtering.
    
    Attributes:
        queryset: All Location objects ordered by name
        serializer_class: LocationSerializer for serialization
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Location created #{instance.pk}")

    def perform_update(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Location updated #{instance.pk}")

    def perform_destroy(self, instance):
        instance_id = instance.pk
        instance.delete()
        self.create_project_revision(f"Location deleted #{instance_id}")



class SupplierViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Supplier model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for seed suppliers. Supports filtering by name via query parameter.
    POST endpoint implements get-or-create behavior.
    
    Attributes:
        queryset: All Supplier objects ordered by name
        serializer_class: SupplierSerializer for serialization
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    def perform_update(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Supplier updated #{instance.pk}")

    def perform_destroy(self, instance):
        instance_id = instance.pk
        instance.delete()
        self.create_project_revision(f"Supplier deleted #{instance_id}")

    
    def get_queryset(self):
        """Filter suppliers by name if query parameter is provided.
        
        :return: Filtered queryset based on query parameters
        """
        queryset = super().get_queryset()
        query = self.request.query_params.get('q', None)
        
        if query:
            # Case-insensitive search in name
            queryset = queryset.filter(name__icontains=query)
        
        return queryset.order_by('name')[:20]  # Limit to 20 results
    
    def create(self, request, *args, **kwargs):
        """Create or get existing supplier by name.
        
        Implements get-or-create behavior based on normalized name.
        Returns existing supplier if one with the same normalized name exists.
        
        :param request: HTTP request containing supplier data
        :return: Response with supplier data and created flag
        """
        name = request.data.get('name', '').strip()
        
        if not name:
            return Response(
                {'name': 'This field is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get or create supplier by normalized name
        from .utils import normalize_supplier_name
        normalized = normalize_supplier_name(name) or ''
        
        supplier, created = Supplier.objects.get_or_create(
            name_normalized=normalized,
            defaults={'name': name}
        )
        
        serializer = self.get_serializer(supplier)
        data = serializer.data
        data['created'] = created
        
        self.create_project_revision(f"Supplier {'created' if created else 'used'} #{supplier.pk}")
        return Response(
            data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class FieldViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Field model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for fields within locations.
    
    Attributes:
        queryset: All Field objects ordered by location and name
        serializer_class: FieldSerializer for serialization
    """
    queryset = Field.objects.all()
    serializer_class = FieldSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Field created #{instance.pk}")

    def perform_update(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Field updated #{instance.pk}")

    def perform_destroy(self, instance):
        instance_id = instance.pk
        instance.delete()
        self.create_project_revision(f"Field deleted #{instance_id}")



class BedViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Bed model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for beds within fields.
    
    Attributes:
        queryset: All Bed objects ordered by field and name
        serializer_class: BedSerializer for serialization
    """
    queryset = Bed.objects.all()
    serializer_class = BedSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Bed created #{instance.pk}")

    def perform_update(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Bed updated #{instance.pk}")

    def perform_destroy(self, instance):
        instance_id = instance.pk
        instance.delete()
        self.create_project_revision(f"Bed deleted #{instance_id}")



class CultureViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Culture model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for crop cultures and varieties.
    
    Attributes:
        queryset: All Culture objects ordered by name and variety
        serializer_class: CultureSerializer for serialization
    """
    queryset = Culture.objects.all()
    serializer_class = CultureSerializer

    
    def perform_create(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Culture created #{instance.pk}")

    def get_queryset(self):
        include_deleted = self.request.query_params.get('include_deleted') in {'1', 'true', 'True'}
        if include_deleted:
            return Culture.all_objects.all()
        return Culture.objects.all()
    
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
                    defaults={'name': supplier_name}
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
        culture.save()

        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id, orphaned_at__isnull=True).update(orphaned_at=timezone.now())

        self.create_project_revision(f"Culture soft-deleted #{culture.pk}")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='undelete')
    def undelete(self, request, pk=None):
        culture = self.get_object()
        culture.deleted_at = None
        culture.save()
        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id).update(orphaned_at=None)
        self.create_project_revision(f"Culture undeleted #{culture.pk}")
        return Response(self.get_serializer(culture).data, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        instance = self.get_object()
        previous_media_id = instance.image_file_id
        updated = serializer.save()
        if previous_media_id and previous_media_id != updated.image_file_id:
            MediaFile.objects.filter(id=previous_media_id, orphaned_at__isnull=True).update(orphaned_at=timezone.now())
        if updated.image_file_id:
            MediaFile.objects.filter(id=updated.image_file_id).update(orphaned_at=None)
        self.create_project_revision(f"Culture updated #{updated.pk}")

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        culture = self.get_object()
        since = timezone.now() - timedelta(days=30)
        rows = culture.revisions.filter(created_at__gte=since).order_by('-created_at')
        payload = [
            {
                'history_id': row.id,
                'culture_id': row.culture_id,
                'history_date': row.created_at,
                'history_type': 'snapshot',
                'history_user': row.user_name or None,
                'summary': ', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot',
            }
            for row in rows
        ]
        return Response(CultureHistoryEntrySerializer(payload, many=True).data)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        lookup_value = self.kwargs.get(self.lookup_field, pk)
        culture = get_object_or_404(Culture.all_objects.all(), pk=lookup_value)
        serializer = CultureRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(culture.revisions.all(), id=revision_id)
        snapshot = revision.snapshot
        allowed_fields = {f.name for f in Culture._meta.fields if f.name not in {'id', 'created_at', 'updated_at'}}

        with transaction.atomic():
            for key, value in snapshot.items():
                if key in allowed_fields:
                    setattr(culture, key, value)
            culture.deleted_at = None
            culture.save()

        self.create_project_revision(f"Culture restored #{culture.pk}")
        return Response(self.get_serializer(culture).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='enrich')
    def enrich(self, request, pk=None):
        """Create AI suggestions for one culture."""
        culture = self.get_object()
        mode = _coerce_request_string(request.data.get('mode'), 'complete')
        try:
            payload = enrich_culture(culture, mode)
        except EnrichmentError as error:
            return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as error:
            logger.exception('Unexpected enrichment error for culture %s', culture.id)
            return Response({'detail': f'Enrichment service failure: {error}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='enrich-batch')
    def enrich_batch(self, request):
        """Create AI suggestions for multiple cultures (synchronous with hard limit)."""
        mode = _coerce_request_string(request.data.get('mode'), 'complete_all')
        requested_ids = request.data.get('culture_ids')
        max_items = min(int(request.data.get('limit', 20)), 50)

        if mode != 'complete_all':
            return Response({'detail': 'Unsupported mode.'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().order_by('id')
        if isinstance(requested_ids, list) and requested_ids:
            queryset = queryset.filter(id__in=requested_ids)

        cultures = list(queryset[:max_items])
        run_id = f"enr_batch_{int(timezone.now().timestamp())}"
        items = []
        for culture in cultures:
            try:
                item = enrich_culture(culture, 'complete')
                items.append({'culture_id': culture.id, 'status': 'completed', 'result': item})
            except EnrichmentError as error:
                items.append({'culture_id': culture.id, 'status': 'failed', 'error': str(error)})
            except Exception as error:
                logger.exception('Unexpected batch enrichment error for culture %s', culture.id)
                items.append({'culture_id': culture.id, 'status': 'failed', 'error': f'Unexpected enrichment failure: {error}'})

        succeeded = sum(1 for item in items if item['status'] == 'completed')
        failed = sum(1 for item in items if item['status'] == 'failed')

        total_input_tokens = 0
        total_cached_input_tokens = 0
        total_output_tokens = 0
        total_cost = 0.0
        total_input_cost = 0.0
        total_cached_input_cost = 0.0
        total_output_cost = 0.0
        total_web_search_cost = 0.0
        total_web_search_call_count = 0
        for item in items:
            result = item.get('result') if isinstance(item, dict) else None
            if not isinstance(result, dict):
                continue
            usage = result.get('usage') if isinstance(result.get('usage'), dict) else {}
            cost = result.get('costEstimate') if isinstance(result.get('costEstimate'), dict) else {}
            breakdown = cost.get('breakdown') if isinstance(cost.get('breakdown'), dict) else {}
            total_input_tokens += int(usage.get('inputTokens') or 0)
            total_cached_input_tokens += int(usage.get('cachedInputTokens') or 0)
            total_output_tokens += int(usage.get('outputTokens') or 0)
            total_cost += float(cost.get('total') or 0)
            total_input_cost += float(breakdown.get('input') or 0)
            total_cached_input_cost += float(breakdown.get('cached_input') or 0)
            total_output_cost += float(breakdown.get('output') or 0)
            total_web_search_cost += float(breakdown.get('web_search_calls') or 0)
            total_web_search_call_count += int(breakdown.get('web_search_call_count') or 0)

        return Response({
            'run_id': run_id,
            'status': 'completed',
            'total': len(items),
            'processed': len(items),
            'succeeded': succeeded,
            'failed': failed,
            'items': items,
            'usage': {
                'inputTokens': total_input_tokens,
                'cachedInputTokens': total_cached_input_tokens,
                'outputTokens': total_output_tokens,
            },
            'costEstimate': {
                'currency': 'USD',
                'total': total_cost,
                'model': 'gpt-4.1',
                'breakdown': {
                    'input': total_input_cost,
                    'cached_input': total_cached_input_cost,
                    'output': total_output_cost,
                    'web_search_calls': total_web_search_cost,
                    'web_search_call_count': total_web_search_call_count,
                },
            },
        }, status=status.HTTP_200_OK)




class SeedPackageViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
    queryset = SeedPackage.objects.select_related('culture').all().order_by('size_unit', 'size_value')
    serializer_class = SeedPackageSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Seed package created #{instance.pk}")

    def perform_update(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Seed package updated #{instance.pk}")

    def perform_destroy(self, instance):
        package_id = instance.pk
        instance.delete()
        self.create_project_revision(f"Seed package deleted #{package_id}")

class PlantingPlanViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
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
        .select_related('culture', 'bed')
        .annotate(note_attachment_count=Count('attachments'))
        .order_by('-planting_date')
    )
    serializer_class = PlantingPlanSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"PlantingPlan created #{instance.pk}")

    def perform_update(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"PlantingPlan updated #{instance.pk}")

    def perform_destroy(self, instance):
        instance_id = instance.pk
        instance.delete()
        self.create_project_revision(f"PlantingPlan deleted #{instance_id}")


    @action(detail=False, methods=['get'], url_path='remaining-area')
    def remaining_area(self, request):
        """Calculate remaining bed area for a time interval.

        :param request: DRF request with bed_id, start_date, end_date and optional exclude_plan_id.
        :return: Remaining area payload for the requested bed and interval.
        """
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

class TaskViewSet(ProjectRevisionMixin, viewsets.ModelViewSet):
    """ViewSet for Task model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for farm management tasks.
    
    Attributes:
        queryset: All Task objects ordered by due_date and created_at
        serializer_class: TaskSerializer for serialization
    """
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Task created #{instance.pk}")

    def perform_update(self, serializer):
        instance = serializer.save()
        self.create_project_revision(f"Task updated #{instance.pk}")

    def perform_destroy(self, instance):
        instance_id = instance.pk
        instance.delete()
        self.create_project_revision(f"Task deleted #{instance_id}")






class CultureUndeleteView(APIView):
    """Undelete a soft-deleted culture by ID."""

    def post(self, request, pk: int):
        culture = get_object_or_404(Culture.all_objects.all(), pk=pk)
        culture.deleted_at = None
        culture.save()
        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id).update(orphaned_at=None)
        _create_project_revision(f"Culture undeleted #{culture.pk}")
        return Response(CultureSerializer(culture).data, status=status.HTTP_200_OK)


class ProjectHistoryListView(APIView):
    """List full-project snapshots."""

    def get(self, request):
        since = timezone.now() - timedelta(days=30)
        rows = ProjectRevision.objects.filter(created_at__gte=since).order_by('-created_at')
        payload = [
            {
                'history_id': row.id,
                'history_date': row.created_at,
                'history_type': 'project_snapshot',
                'history_user': None,
                'summary': row.summary or f"Project snapshot #{row.id}",
            }
            for row in rows
        ]
        return Response(CultureHistoryEntrySerializer(payload, many=True).data)


class ProjectHistoryRestoreView(APIView):
    """Restore whole project state from a snapshot."""

    def post(self, request):
        serializer = CultureRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(ProjectRevision.objects.all(), id=revision_id)
        _restore_project_state(revision.snapshot)
        _create_project_revision(f"Project restored from snapshot #{revision_id}")

        return Response({'detail': 'Project restored successfully.'}, status=status.HTTP_200_OK)


class GlobalHistoryListView(APIView):
    """List recent history entries across all cultures."""

    def get(self, request):
        since = timezone.now() - timedelta(days=30)
        rows = (
            CultureRevision.objects
            .select_related('culture')
            .filter(created_at__gte=since)
            .order_by('-created_at')
        )
        payload = [
            {
                'history_id': row.id,
                'culture_id': row.culture_id,
                'history_date': row.created_at,
                'history_type': 'snapshot',
                'history_user': row.user_name or None,
                'summary': f"Culture #{row.culture_id}: " + (', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot'),
            }
            for row in rows
        ]
        return Response(CultureHistoryEntrySerializer(payload, many=True).data)


class GlobalHistoryRestoreView(APIView):
    """Restore a culture from a global history entry (supports soft-deleted cultures)."""

    def post(self, request):
        serializer = CultureRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(CultureRevision.objects.select_related('culture'), id=revision_id)
        culture = revision.culture
        snapshot = revision.snapshot
        allowed_fields = {f.name for f in Culture._meta.fields if f.name not in {'id', 'created_at', 'updated_at'}}

        with transaction.atomic():
            for key, value in snapshot.items():
                if key in allowed_fields:
                    setattr(culture, key, value)
            culture.deleted_at = None
            culture.save()

        _create_project_revision(f"Culture undeleted #{culture.pk}")
        return Response(CultureSerializer(culture).data, status=status.HTTP_200_OK)


class MediaFileUploadView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        upload = request.FILES.get('file')
        if upload is None:
            return Response({'file': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        rel_path = culture_media_upload_path(None, upload.name)
        saved_path = default_storage.save(rel_path, upload)
        media = MediaFile.objects.create(storage_path=saved_path)
        _create_project_revision(f"Media uploaded #{media.pk}")
        return Response({'id': media.id, 'storage_path': media.storage_path, 'uploaded_at': media.uploaded_at}, status=status.HTTP_201_CREATED)

class NoteAttachmentListCreateView(APIView):
    """List and upload image attachments for a planting plan note."""

    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get(self, request, note_id: int):
        plan = get_object_or_404(PlantingPlan, pk=note_id)
        attachments = plan.attachments.all()
        serializer = NoteAttachmentSerializer(attachments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, note_id: int):
        plan = get_object_or_404(PlantingPlan, pk=note_id)

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
            width=metadata['width'],
            height=metadata['height'],
            size_bytes=metadata['size_bytes'],
            mime_type=metadata['mime_type'],
        )
        attachment.image.save(str(metadata.get('filename', 'processed.webp')), content, save=False)
        attachment.save()

        serializer = NoteAttachmentSerializer(attachment, context={'request': request})
        _create_project_revision(f"NoteAttachment created #{attachment.pk}")
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NoteAttachmentDeleteView(APIView):
    """Delete a note attachment."""

    def delete(self, request, attachment_id: int):
        attachment = get_object_or_404(NoteAttachment, pk=attachment_id)
        attachment_id = attachment.pk
        attachment.image.delete(save=False)
        attachment.delete()
        _create_project_revision(f"NoteAttachment deleted #{attachment_id}")
        return Response(status=status.HTTP_204_NO_CONTENT)


class SeedDemandListView(generics.ListAPIView):
    """Read-only endpoint returning gram-based seed demand aggregated by culture."""

    serializer_class = SeedDemandSerializer

    def get_queryset(self):
        total_area_expr = Coalesce(Sum('area_usage_sqm'), Value(0.0), output_field=FloatField())
        total_quantity_expr = Coalesce(Sum('quantity'), Value(0.0), output_field=FloatField())

        return (
            PlantingPlan.objects
            .values(
                'culture_id',
                culture_name=F('culture__name'),
                variety=F('culture__variety'),
                supplier=Coalesce(
                    F('culture__supplier__name'),
                    F('culture__seed_supplier'),
                    Value('', output_field=CharField()),
                ),
                seed_rate_value=F('culture__seed_rate_value'),
                seed_rate_unit=F('culture__seed_rate_unit'),
                thousand_kernel_weight_g=F('culture__thousand_kernel_weight_g'),
                safety_margin_percent=Coalesce(F('culture__sowing_calculation_safety_percent'), Value(0.0), output_field=FloatField()),
                row_spacing_m=F('culture__row_spacing_m'),
            )
            .annotate(
                total_area_sqm=total_area_expr,
                total_quantity=total_quantity_expr,
            )
            .annotate(
                base_grams=Case(
                    When(
                        Q(seed_rate_unit='g_per_m2') & Q(seed_rate_value__isnull=False) & Q(total_area_sqm__gt=0),
                        then=ExpressionWrapper(F('total_area_sqm') * F('seed_rate_value'), output_field=FloatField()),
                    ),
                    When(
                        Q(seed_rate_unit='seeds/m')
                        & Q(seed_rate_value__isnull=False)
                        & Q(thousand_kernel_weight_g__isnull=False)
                        & Q(row_spacing_m__gt=0)
                        & Q(total_area_sqm__gt=0),
                        then=ExpressionWrapper(
                            (F('total_area_sqm') / F('row_spacing_m'))
                            * F('seed_rate_value')
                            * (F('thousand_kernel_weight_g') / Value(1000.0)),
                            output_field=FloatField(),
                        ),
                    ),
                    When(
                        Q(seed_rate_unit__in=['seeds_per_plant', 'pcs_per_plant'])
                        & Q(seed_rate_value__isnull=False)
                        & Q(thousand_kernel_weight_g__isnull=False)
                        & Q(total_quantity__gt=0),
                        then=ExpressionWrapper(
                            F('total_quantity')
                            * F('seed_rate_value')
                            * (F('thousand_kernel_weight_g') / Value(1000.0)),
                            output_field=FloatField(),
                        ),
                    ),
                    default=Value(None, output_field=FloatField()),
                ),
            )
            .annotate(
                total_grams=Case(
                    When(
                        base_grams__isnull=False,
                        then=ExpressionWrapper(
                            F('base_grams') * (Value(1.0) + (F('safety_margin_percent') / Value(100.0))),
                            output_field=FloatField(),
                        ),
                    ),
                    default=Value(None, output_field=FloatField()),
                ),
                warning=Case(
                    When(Q(seed_rate_unit__isnull=True) | Q(seed_rate_unit=''), then=Value('Missing seed rate unit.')),
                    When(seed_rate_value__isnull=True, then=Value('Missing seed rate value.')),
                    When(Q(seed_rate_unit='g_per_m2') & Q(total_area_sqm__lte=0), then=Value('Missing area usage for gram conversion.')),
                    When(Q(seed_rate_unit='seeds/m') & Q(thousand_kernel_weight_g__isnull=True), then=Value('Missing thousand-kernel weight for conversion to grams.')),
                    When(Q(seed_rate_unit='seeds/m') & (Q(row_spacing_m__isnull=True) | Q(row_spacing_m__lte=0)), then=Value('Missing row spacing for conversion from seeds/m to grams.')),
                    When(Q(seed_rate_unit='seeds/m') & Q(total_area_sqm__lte=0), then=Value('Missing area usage for conversion from seeds/m to grams.')),
                    When(Q(seed_rate_unit__in=['seeds_per_plant', 'pcs_per_plant']) & Q(thousand_kernel_weight_g__isnull=True), then=Value('Missing thousand-kernel weight for conversion to grams.')),
                    When(Q(seed_rate_unit__in=['seeds_per_plant', 'pcs_per_plant']) & Q(total_quantity__lte=0), then=Value('Missing plant quantity for conversion from seeds per plant to grams.')),
                    default=Value(None, output_field=CharField()),
                ),
            )
            .order_by('culture_name', 'variety')
        )

    def list(self, request, *args, **kwargs):
        rows = list(self.get_queryset())
        culture_ids = [row['culture_id'] for row in rows]
        package_map: dict[int, list[SeedPackage]] = defaultdict(list)
        for package in SeedPackage.objects.filter(culture_id__in=culture_ids, available=True).order_by('size_unit', 'size_value'):
            package_map[package.culture_id].append(package)

        for row in rows:
            total_grams = row.get('total_grams')
            packages = package_map.get(row['culture_id'], [])
            row['seed_packages'] = [
                {
                    'size_value': float(pkg.size_value),
                    'size_unit': pkg.size_unit,
                    'available': pkg.available,
                }
                for pkg in packages
            ]

            if total_grams is None:
                row['package_suggestion'] = None
                continue

            suggestion = compute_seed_package_suggestion(
                required_amount=Decimal(str(total_grams)),
                packages=[PackageOption(size_value=pkg.size_value, size_unit=pkg.size_unit) for pkg in packages],
                unit='g',
            )
            if suggestion.pack_count == 0:
                row['package_suggestion'] = None
                continue

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
            }

        serializer = self.get_serializer(rows, many=True)
        return Response({'count': len(rows), 'next': None, 'previous': None, 'results': serializer.data})

