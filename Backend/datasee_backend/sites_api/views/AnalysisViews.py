from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializers import AnalyzeRequestSerializer, PolygonAnalyzeSerializer
from ..services import (
    analyze_sites_in_polygon,
    compute_statistics,
    get_active_weights,
    recalculate_all_sites,
)
from .SiteViews import _parse_optional_float


class AnalyzeView(APIView):
    """POST /api/analyze — Recalculate suitability scores using custom factor weights."""

    @extend_schema(
        request=AnalyzeRequestSerializer,
        responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
        tags=['Analysis'],
    )
    def post(self, request):
        serializer = AnalyzeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        weights = serializer.validated_data['weights']
        persist = serializer.validated_data.get('persist', True)
        if persist and (not request.user or not request.user.is_authenticated):
            return Response(
                {'detail': 'Authentication required to save analysis weights.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        result = recalculate_all_sites(weights=weights, persist=persist)
        return Response(result, status=status.HTTP_200_OK)


class PolygonAnalyzeView(APIView):
    """POST /api/analyze/polygon — Analyze candidate sites inside a drawn polygon."""

    @extend_schema(
        request=PolygonAnalyzeSerializer,
        responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
        tags=['Analysis'],
    )
    def post(self, request):
        serializer = PolygonAnalyzeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        polygon = serializer.validated_data['polygon']
        return Response(analyze_sites_in_polygon(polygon), status=status.HTTP_200_OK)


class StatisticsView(APIView):
    """GET /api/statistics — Return summary KPIs, score distribution, breakdowns, and Top 10."""

    @extend_schema(
        parameters=[
            OpenApiParameter('min_score', OpenApiTypes.FLOAT, description='Minimum suitability score'),
            OpenApiParameter('max_score', OpenApiTypes.FLOAT, description='Maximum suitability score'),
            OpenApiParameter('region', OpenApiTypes.STR, description='Filter by region'),
            OpenApiParameter('land_type', OpenApiTypes.STR, description='Filter by land type'),
        ],
        responses={200: OpenApiTypes.OBJECT},
        tags=['Statistics'],
    )
    def get(self, request):
        try:
            min_score = _parse_optional_float(request.query_params.get('min_score'), 'min_score')
            max_score = _parse_optional_float(request.query_params.get('max_score'), 'max_score')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        stats = compute_statistics(
            min_score=min_score,
            max_score=max_score,
            region=request.query_params.get('region'),
            land_type=request.query_params.get('land_type'),
        )
        return Response(stats, status=status.HTTP_200_OK)


class WeightsView(APIView):
    """GET /api/weights — Return currently active analysis weights."""

    @extend_schema(responses={200: OpenApiTypes.OBJECT}, tags=['Analysis'])
    def get(self, request):
        return Response({'weights': get_active_weights()}, status=status.HTTP_200_OK)
