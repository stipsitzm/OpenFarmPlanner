from rest_framework.routers import DefaultRouter

from .views import CropViewSet

router = DefaultRouter()
router.register(r'', CropViewSet, basename='crops')

urlpatterns = router.urls
