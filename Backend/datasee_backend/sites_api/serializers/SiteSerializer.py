from rest_framework import serializers


class WeightInputSerializer(serializers.Serializer):
    """Validates the 5 factor weights for suitability score recalculation."""

    solar = serializers.FloatField(min_value=0.0, max_value=1.0)
    area = serializers.FloatField(min_value=0.0, max_value=1.0)
    grid = serializers.FloatField(min_value=0.0, max_value=1.0)
    slope = serializers.FloatField(min_value=0.0, max_value=1.0)
    infrastructure = serializers.FloatField(min_value=0.0, max_value=1.0)

    def validate(self, attrs: dict[str, float]) -> dict[str, float]:
        total = sum(attrs.values())
        if abs(total - 1.0) >= 0.001:
            raise serializers.ValidationError(
                f'Weights must sum to 1.0 (received {total:.4f}).'
            )
        return attrs


class AnalyzeRequestSerializer(serializers.Serializer):
    """Request payload for POST /api/analyze."""

    weights = WeightInputSerializer()
    persist = serializers.BooleanField(default=True, required=False)


class PolygonAnalyzeSerializer(serializers.Serializer):
    """Request payload for POST /api/analyze/polygon containing [lat, lon] pairs."""

    polygon = serializers.ListField(
        child=serializers.ListField(
            child=serializers.FloatField(),
            min_length=2,
            max_length=2,
        ),
        min_length=3,
    )


class SiteUploadSerializer(serializers.Serializer):
    """Multipart CSV upload payload for POST /api/sites/upload."""

    file = serializers.FileField()

    def validate_file(self, uploaded_file):
        name = (uploaded_file.name or '').lower()
        if not name.endswith('.csv'):
            raise serializers.ValidationError('Only .csv files are supported.')
        max_bytes = 5 * 1024 * 1024  # 5 MB safety limit
        if uploaded_file.size > max_bytes:
            raise serializers.ValidationError('CSV file size must not exceed 5 MB.')
        return uploaded_file


class SiteScoreBreakdownSerializer(serializers.Serializer):
    solar = serializers.FloatField()
    area = serializers.FloatField()
    grid = serializers.FloatField()
    slope = serializers.FloatField()
    infrastructure = serializers.FloatField()


class SiteSummarySerializer(serializers.Serializer):
    site_id = serializers.IntegerField()
    site_name = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    area_sqm = serializers.IntegerField()
    area_acres = serializers.FloatField()
    estimated_capacity_mw = serializers.FloatField()
    solar_irradiance_kwh = serializers.FloatField()
    grid_distance_km = serializers.FloatField()
    slope_degrees = serializers.FloatField()
    road_distance_km = serializers.FloatField()
    elevation_m = serializers.IntegerField()
    land_type = serializers.CharField()
    region = serializers.CharField()
    solar_irradiance_score = serializers.FloatField()
    area_score = serializers.FloatField()
    grid_distance_score = serializers.FloatField()
    slope_score = serializers.FloatField()
    infrastructure_score = serializers.FloatField()
    total_suitability_score = serializers.FloatField()
    category = serializers.CharField()
    recommendation = serializers.CharField()
    color = serializers.CharField()
    rank = serializers.IntegerField()
    analysis_timestamp = serializers.CharField(allow_null=True)


class SiteDetailSerializer(SiteSummarySerializer):
    total_sites_ranked = serializers.IntegerField()
    score_breakdown = SiteScoreBreakdownSerializer()
    weighted_contributions = SiteScoreBreakdownSerializer()
    weights_used = SiteScoreBreakdownSerializer()


class SiteWriteSerializer(serializers.Serializer):
    """Validates create/update payloads for POST /api/sites/ and PUT/PATCH /api/sites/{id}/."""

    site_name = serializers.CharField(max_length=255, allow_blank=False, trim_whitespace=True)
    latitude = serializers.FloatField(min_value=-90.0, max_value=90.0)
    longitude = serializers.FloatField(min_value=-180.0, max_value=180.0)
    area_sqm = serializers.IntegerField(min_value=1)
    solar_irradiance_kwh = serializers.FloatField(min_value=0.0, max_value=24.0)
    grid_distance_km = serializers.FloatField(min_value=0.0)
    slope_degrees = serializers.FloatField(min_value=0.0, max_value=90.0)
    road_distance_km = serializers.FloatField(min_value=0.0)
    elevation_m = serializers.IntegerField()
    land_type = serializers.CharField(max_length=50, allow_blank=False, trim_whitespace=True)
    region = serializers.CharField(max_length=100, allow_blank=False, trim_whitespace=True)
