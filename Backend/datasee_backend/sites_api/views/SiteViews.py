from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializers import SiteDetailSerializer, SiteUploadSerializer, SiteWriteSerializer
from ..services import (
    create_or_update_site,
    delete_site,
    get_site_detail,
    import_sites_from_csv,
    list_sites_with_scores,
)


def _parse_optional_float(raw_value: str | None, param_name: str) -> float | None:
    if raw_value is None or raw_value == '':
        return None
    try:
        return float(raw_value)
    except ValueError as exc:
        raise ValueError(f'Invalid numeric value for "{param_name}": {raw_value}') from exc


def _parse_optional_int(
    raw_value: str | None,
    param_name: str,
    default: int,
    minimum: int = 0,
    maximum: int = 1000,
) -> int:
    if raw_value is None or raw_value == '':
        return default
    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise ValueError(f'Invalid integer value for "{param_name}": {raw_value}') from exc
    if parsed < minimum or parsed > maximum:
        raise ValueError(f'"{param_name}" must be between {minimum} and {maximum}.')
    return parsed


class SiteListView(APIView):
    """GET /api/sites/ (public) & POST /api/sites/ (authenticated)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        operation_id='list_sites',
        parameters=[
            OpenApiParameter('min_score', OpenApiTypes.FLOAT, description='Minimum suitability score (0-100)'),
            OpenApiParameter('max_score', OpenApiTypes.FLOAT, description='Maximum suitability score (0-100)'),
            OpenApiParameter('region', OpenApiTypes.STR, description='Filter by region'),
            OpenApiParameter('land_type', OpenApiTypes.STR, description='Filter by land type'),
            OpenApiParameter('search', OpenApiTypes.STR, description='Search by site name, region, or land type'),
            OpenApiParameter('sort_by', OpenApiTypes.STR, description='Sort field (default: total_suitability_score)'),
            OpenApiParameter('sort_order', OpenApiTypes.STR, description='asc or desc (default: desc)'),
            OpenApiParameter('limit', OpenApiTypes.INT, description='Max results to return (default: 100)'),
            OpenApiParameter('offset', OpenApiTypes.INT, description='Pagination offset (default: 0)'),
        ],
        responses={200: OpenApiTypes.OBJECT},
        tags=['Sites'],
    )
    def get(self, request):
        try:
            min_score = _parse_optional_float(request.query_params.get('min_score'), 'min_score')
            max_score = _parse_optional_float(request.query_params.get('max_score'), 'max_score')
            limit = _parse_optional_int(request.query_params.get('limit'), 'limit', default=100, minimum=1, maximum=500)
            offset = _parse_optional_int(request.query_params.get('offset'), 'offset', default=0, minimum=0, maximum=100000)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if min_score is not None and max_score is not None and min_score > max_score:
            return Response(
                {'detail': 'min_score cannot be greater than max_score.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = list_sites_with_scores(
            min_score=min_score,
            max_score=max_score,
            region=request.query_params.get('region'),
            land_type=request.query_params.get('land_type'),
            search=request.query_params.get('search'),
            sort_by=request.query_params.get('sort_by', 'total_suitability_score'),
            sort_order=request.query_params.get('sort_order', 'desc'),
            limit=limit,
            offset=offset,
        )
        return Response(payload, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id='create_site',
        request=SiteWriteSerializer,
        responses={201: SiteDetailSerializer, 400: OpenApiTypes.OBJECT},
        tags=['Sites'],
    )
    def post(self, request):
        serializer = SiteWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        created_site = create_or_update_site(serializer.validated_data)
        return Response(created_site, status=status.HTTP_201_CREATED)


class SiteDetailView(APIView):
    """GET (public) and PUT/PATCH/DELETE (authenticated) for /api/sites/{id}/."""

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        operation_id='retrieve_site',
        responses={200: SiteDetailSerializer, 404: OpenApiTypes.OBJECT},
        tags=['Sites'],
    )
    def get(self, request, site_id: int | str):
        site_data = get_site_detail(int(site_id))
        if site_data is None:
            return Response(
                {'detail': f'Site with id {site_id} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(site_data, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id='update_site',
        request=SiteWriteSerializer,
        responses={200: SiteDetailSerializer, 400: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
        tags=['Sites'],
    )
    def put(self, request, site_id: int | str):
        return self._update(request, int(site_id), partial=False)

    @extend_schema(
        operation_id='partial_update_site',
        request=SiteWriteSerializer,
        responses={200: SiteDetailSerializer, 400: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
        tags=['Sites'],
    )
    def patch(self, request, site_id: int | str):
        return self._update(request, int(site_id), partial=True)

    @extend_schema(
        operation_id='delete_site',
        responses={204: None, 404: OpenApiTypes.OBJECT},
        tags=['Sites'],
    )
    def delete(self, request, site_id: int | str):
        deleted = delete_site(int(site_id))
        if not deleted:
            return Response(
                {'detail': f'Site with id {site_id} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _update(self, request, site_id: int, partial: bool):
        if get_site_detail(site_id) is None:
            return Response(
                {'detail': f'Site with id {site_id} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = SiteWriteSerializer(data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_site = create_or_update_site(serializer.validated_data, site_id=site_id)
        return Response(updated_site, status=status.HTTP_200_OK)


class SiteUploadView(APIView):
    """POST /api/sites/upload/ — Authenticated CSV dataset import and scoring."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=SiteUploadSerializer,
        responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
        tags=['Sites'],
    )
    def post(self, request):
        serializer = SiteUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = serializer.validated_data['file']
        try:
            summary = import_sites_from_csv(uploaded_file)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'message': 'CSV dataset imported and scored successfully.',
                **summary,
            },
            status=status.HTTP_201_CREATED,
        )
