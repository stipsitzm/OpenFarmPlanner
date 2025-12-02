from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LocationViewSet,
    FieldViewSet,
    BedViewSet,
    CultureViewSet,
    PlantingPlanViewSet,
    TaskViewSet,
)

router = DefaultRouter()
router.register(r'locations', LocationViewSet)
router.register(r'fields', FieldViewSet)
router.register(r'beds', BedViewSet)
router.register(r'cultures', CultureViewSet)
router.register(r'planting-plans', PlantingPlanViewSet)
router.register(r'tasks', TaskViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
