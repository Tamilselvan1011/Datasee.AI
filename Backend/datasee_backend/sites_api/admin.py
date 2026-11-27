from django.contrib import admin

from .models import AnalysisParameter, AnalysisResult, Site


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = (
        'site_id',
        'site_name',
        'region',
        'land_type',
        'area_sqm',
        'solar_irradiance_kwh',
        'grid_distance_km',
        'slope_degrees',
    )
    list_filter = ('region', 'land_type')
    search_fields = ('site_name', 'region', 'land_type')


@admin.register(AnalysisParameter)
class AnalysisParameterAdmin(admin.ModelAdmin):
    list_display = ('param_id', 'parameter_name', 'weight_value', 'is_active', 'updated_at')
    list_filter = ('is_active',)


@admin.register(AnalysisResult)
class AnalysisResultAdmin(admin.ModelAdmin):
    list_display = (
        'result_id',
        'site',
        'total_suitability_score',
        'solar_irradiance_score',
        'area_score',
        'grid_distance_score',
        'slope_score',
        'infrastructure_score',
        'analysis_timestamp',
    )
    list_filter = ('analysis_timestamp',)
    search_fields = ('site__site_name',)
