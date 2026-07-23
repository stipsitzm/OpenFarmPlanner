"""
Read-only crop library API. Intentionally requires authentication only
(`IsAuthenticated`, the same DRF default every other endpoint in this
project uses) and does no project scoping at all — a published crop
belongs to the library, not to any one project.

This mirrors `farm.cultures.views.PublicCultureViewSet` (which keeps serving
`/api/public-cultures/` unchanged for the current frontend) rather than
replacing it, so this is purely additive: a new, forward-looking surface
at `/api/crops/` that can later be made genuinely public (e.g. by
swapping the permission class) without touching anything that already
works. See docs/crop-library-architecture.md.
"""
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import services
from .models import CropSpecies
from .serializers import CropSerializer, CropSpeciesSerializer


class CropSpeciesViewSet(viewsets.ModelViewSet):
    """Official crop species list plus lightweight user proposals."""

    serializer_class = CropSpeciesSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CropSpecies.objects.all().order_by('name')
        include_proposed = self.request.query_params.get('include_proposed') in {'1', 'true', 'True'}
        if not include_proposed:
            queryset = queryset.filter(status=CropSpecies.STATUS_PUBLISHED)
        query = (self.request.query_params.get('q') or '').strip()
        if query:
            queryset = queryset.filter(name__icontains=query)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        species = serializer.save(status=CropSpecies.STATUS_PROPOSED)
        return Response(self.get_serializer(species).data, status=status.HTTP_201_CREATED)


class CropViewSet(viewsets.ReadOnlyModelViewSet):
    """Published crops: list/retrieve, plus an exact-match lookup."""

    serializer_class = CropSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        params = self.request.query_params
        return services.list_published_crops(
            query=params.get('q') or '',
            name=params.get('name') or '',
            variety=params.get('variety') or '',
        )

    @action(detail=False, methods=['get'], url_path='match')
    def match(self, request):
        crop = services.find_exact_crop_match(
            name=request.query_params.get('name'),
            variety=request.query_params.get('variety'),
        )
        if crop is None:
            return Response({'exists': False, 'crop': None})

        return Response({
            'exists': True,
            'crop': {
                'id': crop.id,
                'name': crop.name,
                'variety': crop.variety,
            },
        })
