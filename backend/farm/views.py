"""ViewSets for the farm app API endpoints.

This module provides RESTful API endpoints for all farm models using
Django REST Framework's ModelViewSet. Each ViewSet handles CRUD operations
for its respective model.
"""

from rest_framework import viewsets
from .models import Location, Field, Bed, Culture, PlantingPlan, Task
from .serializers import (
    LocationSerializer,
    FieldSerializer,
    BedSerializer,
    CultureSerializer,
    PlantingPlanSerializer,
    TaskSerializer,
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


class PlantingPlanViewSet(viewsets.ModelViewSet):
    """ViewSet for PlantingPlan model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for planting plans. The harvest_date is automatically calculated
    on creation and update based on the culture's days_to_harvest.
    
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

