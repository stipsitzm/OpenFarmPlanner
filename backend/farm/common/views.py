"""Domain-agnostic platform endpoints."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from config.version import get_version


class VersionView(APIView):
    """Return the current backend/API version."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):  # noqa: ANN001, ARG002
        return Response({'version': get_version()})
