"""ViewSets for the farm app API endpoints.

This module provides RESTful API endpoints for all farm models using
Django REST Framework's ModelViewSet. Each ViewSet handles CRUD operations
for its respective model.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db.models import Case, When, Value, F, FloatField, IntegerField, ExpressionWrapper, Sum, CharField, Q
from django.db.models.functions import Coalesce, Ceil, Cast
from rest_framework import viewsets, status, generics, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Location, Field, Bed, Culture, PlantingPlan, Task, Supplier, NoteAttachment
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
)
from .image_processing import process_note_image, ImageProcessingError


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


class LocationViewSet(viewsets.ModelViewSet):
    """ViewSet for Location model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for farm locations. All locations are returned without filtering.
    
    Attributes:
        queryset: All Location objects ordered by name
        serializer_class: LocationSerializer for serialization
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer


class SupplierViewSet(viewsets.ModelViewSet):
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
        
        return Response(
            data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class FieldViewSet(viewsets.ModelViewSet):
    """ViewSet for Field model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for fields within locations.
    
    Attributes:
        queryset: All Field objects ordered by location and name
        serializer_class: FieldSerializer for serialization
    """
    queryset = Field.objects.all()
    serializer_class = FieldSerializer


class BedViewSet(viewsets.ModelViewSet):
    """ViewSet for Bed model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for beds within fields.
    
    Attributes:
        queryset: All Bed objects ordered by field and name
        serializer_class: BedSerializer for serialization
    """
    queryset = Bed.objects.all()
    serializer_class = BedSerializer


class CultureViewSet(viewsets.ModelViewSet):
    """ViewSet for Culture model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for crop cultures and varieties.
    
    Attributes:
        queryset: All Culture objects ordered by name and variety
        serializer_class: CultureSerializer for serialization
    """
    queryset = Culture.objects.all()
    serializer_class = CultureSerializer
    
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
    
    def _find_matching_culture(self, name: str, variety: str | None, supplier: Supplier | None) -> Culture | None:
        """Find existing culture by normalized fields.
        
        :param name: Culture name
        :param variety: Culture variety (optional)
        :param supplier: Supplier instance (optional)
        :return: Matching Culture instance or None
        """
        from .utils import normalize_text
        
        name_norm = normalize_text(name) or ''
        variety_norm = normalize_text(variety)
        
        try:
            return Culture.objects.get(
                name_normalized=name_norm,
                variety_normalized=variety_norm,
                supplier=supplier
            )
        except Culture.DoesNotExist:
            return None
    
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
            'thousand_kernel_weight_g', 'package_size_g',
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
                matching_culture = self._find_matching_culture(name, variety, supplier)
                
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
                matching_culture = self._find_matching_culture(name, variety, supplier)
                
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
    
class PlantingPlanViewSet(viewsets.ModelViewSet):
    """ViewSet for PlantingPlan model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for planting plans. The harvest_date is automatically calculated
    on creation and update based on the culture's growth_duration_days.
    
    Attributes:
        queryset: All PlantingPlan objects ordered by planting_date (descending)
        serializer_class: PlantingPlanSerializer for serialization
    """
    queryset = PlantingPlan.objects.all()
    serializer_class = PlantingPlanSerializer


class TaskViewSet(viewsets.ModelViewSet):
    """ViewSet for Task model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for farm management tasks.
    
    Attributes:
        queryset: All Task objects ordered by due_date and created_at
        serializer_class: TaskSerializer for serialization
    """
    queryset = Task.objects.all()
    serializer_class = TaskSerializer



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
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NoteAttachmentDeleteView(APIView):
    """Delete a note attachment."""

    def delete(self, request, attachment_id: int):
        attachment = get_object_or_404(NoteAttachment, pk=attachment_id)
        attachment.image.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SeedDemandListView(generics.ListAPIView):
    """Read-only endpoint returning gram-based seed demand aggregated by culture."""

    serializer_class = SeedDemandSerializer

    def get_queryset(self):
        """Build aggregated queryset with DB-side calculations and warnings."""
        total_area_expr = Coalesce(Sum('area_usage_sqm'), Value(0.0), output_field=FloatField())
        total_quantity_expr = Coalesce(Sum('quantity'), Value(0.0), output_field=FloatField())

        queryset = (
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
                package_size_g=F('culture__package_size_g'),
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
            )
            .annotate(
                packages_needed=Case(
                    When(
                        Q(total_grams__isnull=False) & Q(package_size_g__gt=0),
                        then=Cast(Ceil(F('total_grams') / F('package_size_g')), IntegerField()),
                    ),
                    default=Value(None, output_field=IntegerField()),
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

        return queryset
