from django.conf import settings
from django.db import models

from .SiteModel import Site


class AnalysisResult(models.Model):
    """Calculated suitability score breakdown and snapshot for a site."""

    result_id = models.AutoField(primary_key=True)
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        db_column='site_id',
        related_name='analysis_results',
    )
    solar_irradiance_score = models.DecimalField(max_digits=5, decimal_places=2)
    area_score = models.DecimalField(max_digits=5, decimal_places=2)
    grid_distance_score = models.DecimalField(max_digits=5, decimal_places=2)
    slope_score = models.DecimalField(max_digits=5, decimal_places=2)
    infrastructure_score = models.DecimalField(max_digits=5, decimal_places=2)
    total_suitability_score = models.DecimalField(max_digits=5, decimal_places=2)
    analysis_timestamp = models.DateTimeField(auto_now_add=True)
    parameters_snapshot = models.JSONField(null=True, blank=True)

    class Meta:
        managed = getattr(settings, 'TESTING', False)
        db_table = 'analysis_results'
        ordering = ['-analysis_timestamp', '-result_id']

    def __str__(self) -> str:
        return f'Site #{self.site_id} -> {self.total_suitability_score}'
