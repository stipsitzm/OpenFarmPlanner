"""Read-only public culture library endpoints."""


from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from farm.models import (
    PublicCulture,
)
from farm.project_context import get_active_project_or_400
from farm.services.public_cultures import (
    PublicCulturePermissionError,
    PublicCultureStatusTransitionError,
    hard_delete_public_culture,
    import_public_culture_into_project,
    remove_public_culture,
    withdraw_public_culture,
)

from ..serializers import (
    CultureSerializer,
    PublicCultureSerializer,
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

    def _get_public_culture_for_status_action(self) -> PublicCulture:
        return get_object_or_404(
            PublicCulture.objects.select_related('created_by'),
            pk=self.kwargs.get(self.lookup_url_kwarg or self.lookup_field),
        )

    @staticmethod
    def _transition_error_response(error: Exception, response_status: int) -> Response:
        code = getattr(error, 'code', 'invalid_status_transition')
        return Response({'detail': str(error), 'code': code}, status=response_status)

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

    @action(detail=True, methods=['post'], url_path='withdraw')
    def withdraw(self, request, pk=None):
        public_culture = self._get_public_culture_for_status_action()
        try:
            updated = withdraw_public_culture(public_culture=public_culture, user=request.user)
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureStatusTransitionError as error:
            return self._transition_error_response(error, status.HTTP_400_BAD_REQUEST)
        return Response(PublicCultureSerializer(updated).data)

    @action(detail=True, methods=['post'], url_path='remove')
    def remove(self, request, pk=None):
        public_culture = self._get_public_culture_for_status_action()
        try:
            updated = remove_public_culture(
                public_culture=public_culture,
                user=request.user,
                reason=(request.data.get('reason') or '').strip(),
            )
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureStatusTransitionError as error:
            return self._transition_error_response(error, status.HTTP_400_BAD_REQUEST)
        return Response(PublicCultureSerializer(updated).data)

    @action(detail=True, methods=['post'], url_path='hard-delete')
    def hard_delete(self, request, pk=None):
        public_culture = self._get_public_culture_for_status_action()
        try:
            hard_delete_public_culture(public_culture=public_culture, user=request.user)
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureStatusTransitionError as error:
            return self._transition_error_response(error, status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)
