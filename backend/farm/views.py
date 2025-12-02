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
    queryset = Location.objects.all()
    serializer_class = LocationSerializer


class FieldViewSet(viewsets.ModelViewSet):
    queryset = Field.objects.all()
    serializer_class = FieldSerializer


class BedViewSet(viewsets.ModelViewSet):
    queryset = Bed.objects.all()
    serializer_class = BedSerializer


class CultureViewSet(viewsets.ModelViewSet):
    queryset = Culture.objects.all()
    serializer_class = CultureSerializer


class PlantingPlanViewSet(viewsets.ModelViewSet):
    queryset = PlantingPlan.objects.all()
    serializer_class = PlantingPlanSerializer


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

