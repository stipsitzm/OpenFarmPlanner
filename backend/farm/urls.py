from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LocationViewSet,
    SupplierViewSet,
    FieldViewSet,
    BedViewSet,
    CultureViewSet,
    PlantingPlanViewSet,
    TaskViewSet,
    SeedDemandListView,
)

router = DefaultRouter()
router.register(r'locations', LocationViewSet)
router.register(r'suppliers', SupplierViewSet)
router.register(r'fields', FieldViewSet)
router.register(r'beds', BedViewSet)
router.register(r'cultures', CultureViewSet)
router.register(r'planting-plans', PlantingPlanViewSet)
router.register(r'tasks', TaskViewSet)

urlpatterns = [
    path('seed-demand/', SeedDemandListView.as_view(), name='seed-demand-list'),
    path('', include(router.urls)),
]
