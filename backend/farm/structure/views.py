"""API endpoints for the farm structure domain (locations, fields, beds, layouts)."""

import logging

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from farm.common.mixins import ProjectRevisionMixin, ProjectScopedMixin
from farm.history import _entity_display_name, _serialize_instance
from farm.models import Bed, BedLayout, EntityRevision, Field, FieldLayout, Location
from farm.project_context import get_active_project_or_400

from .serializers import (
    BED_NAME_DUPLICATE_MESSAGE,
    FIELD_NAME_DUPLICATE_MESSAGE,
    BedLayoutSerializer,
    BedSerializer,
    FieldLayoutSerializer,
    FieldSerializer,
    LocationSerializer,
)

logger = logging.getLogger(__name__)

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
