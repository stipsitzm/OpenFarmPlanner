from rest_framework.pagination import PageNumberPagination


class OpenFarmPlannerPageNumberPagination(PageNumberPagination):
    """Allow bounded page-size overrides for bulk analysis views."""

    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 1000
