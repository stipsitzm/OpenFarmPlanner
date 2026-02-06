"""ViewSets for the farm app API endpoints.

This module provides RESTful API endpoints for all farm models using
Django REST Framework's ModelViewSet. Each ViewSet handles CRUD operations
for its respective model.
"""

from django.core.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Location, Field, Bed, Culture, PlantingPlan, Task, Supplier
from .serializers import (
    LocationSerializer,
    FieldSerializer,
    BedSerializer,
    CultureSerializer,
    PlantingPlanSerializer,
    TaskSerializer,
    SupplierSerializer,
)


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
    
    @action(detail=False, methods=['post'], url_path='import')
    def import_cultures(self, request):
        """Bulk import cultures from JSON data.
        
        Accepts an array of culture objects and creates them in the database.
        Validates each entry and returns information about successful and failed imports.
        
        :param request: HTTP request containing array of culture objects
        :return: Response with import results including created IDs and failed entries
        """
        if not isinstance(request.data, list):
            return Response(
                {'message': 'Request body must be an array of culture objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_cultures = []
        failed_entries = []
        
        for idx, culture_data in enumerate(request.data):
            # Validate that entry has at least a name
            if not isinstance(culture_data, dict) or not culture_data.get('name'):
                failed_entries.append({
                    'index': idx,
                    'data': culture_data,
                    'error': 'Entry must be an object with at least a "name" field.'
                })
                continue
            
            # Try to create the culture
            serializer = CultureSerializer(data=culture_data)
            if serializer.is_valid():
                try:
                    culture = serializer.save()
                    created_cultures.append(culture.id)
                except (ValidationError, ValueError, TypeError) as e:
                    # Catch validation and type errors during save
                    failed_entries.append({
                        'index': idx,
                        'data': culture_data,
                        'error': str(e)
                    })
            else:
                failed_entries.append({
                    'index': idx,
                    'data': culture_data,
                    'error': serializer.errors
                })
        
        return Response({
            'created': len(created_cultures),
            'failed': len(failed_entries),
            'created_ids': created_cultures,
            'failed_entries': failed_entries
        }, status=status.HTTP_201_CREATED if created_cultures else status.HTTP_400_BAD_REQUEST)


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

