from django.conf import settings
from django.db import models


class AnalysisParameter(models.Model):
    """Configurable factor weight stored in the analysis_parameters table."""

    param_id = models.AutoField(primary_key=True)
    parameter_name = models.CharField(max_length=100, unique=True)
    weight_value = models.DecimalField(max_digits=4, decimal_places=3)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = getattr(settings, 'TESTING', False)
        db_table = 'analysis_parameters'
        ordering = ['param_id']

    def __str__(self) -> str:
        return f'{self.parameter_name}: {self.weight_value}'
