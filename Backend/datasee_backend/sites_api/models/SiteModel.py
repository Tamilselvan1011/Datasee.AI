from django.conf import settings
from django.db import models


class Site(models.Model):
    """Spatial and physical attributes for a candidate solar installation site."""

    site_id = models.AutoField(primary_key=True)
    site_name = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    area_sqm = models.IntegerField()
    solar_irradiance_kwh = models.DecimalField(max_digits=4, decimal_places=2)
    grid_distance_km = models.DecimalField(max_digits=5, decimal_places=2)
    slope_degrees = models.DecimalField(max_digits=4, decimal_places=2)
    road_distance_km = models.DecimalField(max_digits=5, decimal_places=2)
    elevation_m = models.IntegerField()
    land_type = models.CharField(max_length=50)
    region = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = getattr(settings, 'TESTING', False)
        db_table = 'sites'
        ordering = ['site_id']

    def __str__(self) -> str:
        return f'{self.site_name} ({self.region})'
