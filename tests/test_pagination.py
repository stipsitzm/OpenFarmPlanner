from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from config.pagination import OpenFarmPlannerPageNumberPagination


def test_bulk_page_size_is_bounded() -> None:
    factory = APIRequestFactory()
    paginator = OpenFarmPlannerPageNumberPagination()

    default_request = Request(factory.get("/api/planting-plans/"))
    bulk_request = Request(factory.get("/api/planting-plans/?page_size=1000"))
    oversized_request = Request(factory.get("/api/planting-plans/?page_size=5000"))

    assert paginator.get_page_size(default_request) == 100
    assert paginator.get_page_size(bulk_request) == 1000
    assert paginator.get_page_size(oversized_request) == 1000
