from django.db import connections
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Site
from ..services import build_export_response, list_sites_with_scores
from .SiteViews import _parse_optional_float


class ExportView(APIView):
    """GET /api/export — Export filtered solar site results as CSV or JSON."""

    @extend_schema(
        parameters=[
            OpenApiParameter('format', OpenApiTypes.STR, description='Export format: csv or json (default: csv)'),
            OpenApiParameter('min_score', OpenApiTypes.FLOAT, description='Minimum suitability score'),
            OpenApiParameter('max_score', OpenApiTypes.FLOAT, description='Maximum suitability score'),
            OpenApiParameter('region', OpenApiTypes.STR, description='Filter by region'),
            OpenApiParameter('land_type', OpenApiTypes.STR, description='Filter by land type'),
        ],
        responses={200: OpenApiTypes.BINARY, 400: OpenApiTypes.OBJECT},
        tags=['Export'],
    )
    def get(self, request):
        export_format = request.query_params.get('format', 'csv').strip().lower()
        if export_format not in ('csv', 'json'):
            return Response(
                {'detail': 'Unsupported export format. Use "csv" or "json".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            min_score = _parse_optional_float(request.query_params.get('min_score'), 'min_score')
            max_score = _parse_optional_float(request.query_params.get('max_score'), 'max_score')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        data = list_sites_with_scores(
            min_score=min_score,
            max_score=max_score,
            region=request.query_params.get('region'),
            land_type=request.query_params.get('land_type'),
            limit=10000,
            offset=0,
        )
        return build_export_response(data['results'], export_format)


class HealthView(APIView):
    """GET /api/health — Verify API and database connectivity."""

    @extend_schema(responses={200: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT}, tags=['Health'])
    def get(self, request):
        try:
            with connections['default'].cursor() as cursor:
                cursor.execute('SELECT 1')
            sites_count = Site.objects.count()
            return Response(
                {
                    'status': 'ok',
                    'database': 'connected',
                    'sites_count': sites_count,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return Response(
                {
                    'status': 'error',
                    'database': 'disconnected',
                    'detail': str(exc),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
