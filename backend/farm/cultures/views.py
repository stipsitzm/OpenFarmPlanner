"""API endpoints for the cultures domain (cultures, suppliers, seeds, public library)."""

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from farm.common.mixins import ProjectRevisionMixin, ProjectScopedMixin
from farm.history import (
    _build_entity_revision_changes,
    _current_actor_label,
    _entity_display_name,
    _serialize_instance,
)
from farm.history.serializers import CultureHistoryEntrySerializer, CultureRestoreSerializer
from farm.models import (
    Culture,
    CultureSupplierData,
    EntityRevision,
    MediaFile,
    PublicCulture,
    SeedPackage,
    Supplier,
)
from farm.project_context import get_active_project_or_400
from farm.services.public_cultures import (
    DuplicatePublicCultureError,
    import_public_culture_into_project,
    publish_culture_to_public_library,
)
from farm.services.seed_demand import build_seed_demand_rows, parse_selected_suppliers

from .serializers import (
    CultureSerializer,
    CultureSupplierDataSerializer,
    PublicCultureSerializer,
    SeedDemandSerializer,
    SeedPackageSerializer,
    SupplierSerializer,
)

logger = logging.getLogger(__name__)


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
        from farm.utils import normalize_supplier_name
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
        from farm.utils import normalize_text

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
        from farm.utils import normalize_supplier_name
        
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
        from farm.utils import normalize_text, normalize_supplier_name
        
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
        queryset = super().get_queryset().select_related('created_by__public_profile')
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
        from farm.utils import normalize_text

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


class SeedDemandListView(ProjectScopedMixin, generics.ListAPIView):
    """Read-only endpoint returning typed seed demand aggregated by culture.

    The calculation itself lives in farm.services.seed_demand (see
    docs/seed-demand-calculation.md); this view only parses the request,
    delegates, and serializes the result.
    """

    serializer_class = SeedDemandSerializer

    def list(self, request, *args, **kwargs):
        rows = build_seed_demand_rows(
            project=request.active_project,
            selected_supplier_by_culture=parse_selected_suppliers(
                request.query_params.get('supplier_selection')
            ),
        )
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
