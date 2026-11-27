import csv
import io
import json
from typing import Any

from django.http import HttpResponse

CSV_FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')

EXPORT_COLUMNS = [
    'rank',
    'site_id',
    'site_name',
    'region',
    'land_type',
    'latitude',
    'longitude',
    'area_sqm',
    'area_acres',
    'estimated_capacity_mw',
    'solar_irradiance_kwh',
    'grid_distance_km',
    'slope_degrees',
    'road_distance_km',
    'elevation_m',
    'solar_irradiance_score',
    'area_score',
    'grid_distance_score',
    'slope_score',
    'infrastructure_score',
    'total_suitability_score',
    'category',
]


def _sanitize_csv_cell(value: Any) -> Any:
    """Neutralize spreadsheet formula injection when exporting string cells."""
    if isinstance(value, str) and value.startswith(CSV_FORMULA_PREFIXES):
        return f"'{value}"
    return value


def build_export_response(rows: list[dict[str, Any]], export_format: str) -> HttpResponse:
    """Build downloadable CSV or JSON HttpResponse for filtered site results."""
    fmt = export_format.strip().lower()
    if fmt == 'json':
        payload = json.dumps({'count': len(rows), 'results': rows}, indent=2)
        response = HttpResponse(payload, content_type='application/json')
        response['Content-Disposition'] = 'attachment; filename="solar_sites_export.json"'
        return response

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_COLUMNS)
    for row in rows:
        writer.writerow([_sanitize_csv_cell(row.get(col, '')) for col in EXPORT_COLUMNS])

    response = HttpResponse(buffer.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="solar_sites_export.csv"'
    return response
