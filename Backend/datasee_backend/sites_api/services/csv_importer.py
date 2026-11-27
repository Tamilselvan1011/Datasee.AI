import csv
from decimal import Decimal
import io
from typing import IO

from django.db import transaction

from ..models import AnalysisParameter, AnalysisResult, Site
from .scoring import DEFAULT_WEIGHTS, WEIGHT_DB_MAPPING, SuitabilityCalculator
from .site_queries import get_active_weights, invalidate_stats_cache

REQUIRED_CSV_COLUMNS = {
    'site_name',
    'latitude',
    'longitude',
    'area_sqm',
    'solar_irradiance_kwh',
    'grid_distance_km',
    'slope_degrees',
    'road_distance_km',
    'elevation_m',
    'land_type',
    'region',
}

DEFAULT_PARAM_DESCRIPTIONS = {
    'solar_irradiance_weight': 'Weight for solar irradiance in suitability calculation',
    'area_weight': 'Weight for available land area in suitability calculation',
    'grid_distance_weight': 'Weight for distance to power grid in suitability calculation',
    'slope_weight': 'Weight for terrain slope in suitability calculation',
    'infrastructure_weight': 'Weight for road/infrastructure proximity in suitability calculation',
}


def ensure_default_parameters() -> None:
    """Seed analysis_parameters with default weights if the table is empty."""
    if AnalysisParameter.objects.exists():
        return
    for api_key, db_name in WEIGHT_DB_MAPPING.items():
        AnalysisParameter.objects.create(
            parameter_name=db_name,
            weight_value=Decimal(str(DEFAULT_WEIGHTS[api_key])),
            description=DEFAULT_PARAM_DESCRIPTIONS[db_name],
            is_active=True,
        )


def _validate_row(row: dict[str, str], line_num: int) -> dict:
    try:
        site_name = (row.get('site_name') or '').strip()
        if not site_name:
            raise ValueError('site_name is required')

        latitude = float(row['latitude'])
        longitude = float(row['longitude'])
        area_sqm = int(float(row['area_sqm']))
        solar = float(row['solar_irradiance_kwh'])
        grid = float(row['grid_distance_km'])
        slope = float(row['slope_degrees'])
        road = float(row['road_distance_km'])
        elevation = int(float(row['elevation_m']))
        land_type = (row.get('land_type') or '').strip()
        region = (row.get('region') or '').strip()
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f'Row {line_num}: invalid or missing field ({exc})') from exc

    if not (-90.0 <= latitude <= 90.0):
        raise ValueError(f'Row {line_num}: latitude must be between -90 and 90')
    if not (-180.0 <= longitude <= 180.0):
        raise ValueError(f'Row {line_num}: longitude must be between -180 and 180')
    if area_sqm <= 0:
        raise ValueError(f'Row {line_num}: area_sqm must be positive')
    if solar < 0 or grid < 0 or road < 0:
        raise ValueError(f'Row {line_num}: irradiance and distances must be non-negative')
    if not (0.0 <= slope <= 90.0):
        raise ValueError(f'Row {line_num}: slope_degrees must be between 0 and 90')
    if not land_type or not region:
        raise ValueError(f'Row {line_num}: land_type and region are required')

    site_id = int(row['site_id']) if row.get('site_id') and str(row['site_id']).strip() else None

    return {
        'site_id': site_id,
        'site_name': site_name,
        'latitude': Decimal(f'{latitude:.7f}'),
        'longitude': Decimal(f'{longitude:.7f}'),
        'area_sqm': area_sqm,
        'solar_irradiance_kwh': Decimal(f'{solar:.2f}'),
        'grid_distance_km': Decimal(f'{grid:.2f}'),
        'slope_degrees': Decimal(f'{slope:.2f}'),
        'road_distance_km': Decimal(f'{road:.2f}'),
        'elevation_m': elevation,
        'land_type': land_type,
        'region': region,
    }


def import_sites_from_csv(file_stream: IO[str] | IO[bytes]) -> dict[str, int]:
    """Parse, validate, upsert CSV site rows and compute initial suitability scores."""
    raw = file_stream.read()
    text = raw.decode('utf-8-sig') if isinstance(raw, bytes) else raw.lstrip('\ufeff')
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise ValueError('CSV file is empty or missing a header row.')

    headers = {h.strip() for h in reader.fieldnames if h}
    missing = REQUIRED_CSV_COLUMNS - headers
    if missing:
        raise ValueError(f'CSV is missing required columns: {sorted(missing)}')

    parsed_rows = [_validate_row(row, idx) for idx, row in enumerate(reader, start=2)]
    if not parsed_rows:
        raise ValueError('CSV file contains no site data rows.')

    weights = get_active_weights()
    calculator = SuitabilityCalculator(weights)
    snapshot = {
        'solar_weight': round(float(weights['solar']), 3),
        'area_weight': round(float(weights['area']), 3),
        'grid_weight': round(float(weights['grid']), 3),
        'slope_weight': round(float(weights['slope']), 3),
        'infra_weight': round(float(weights['infrastructure']), 3),
    }

    created_count = 0
    updated_count = 0
    results_to_insert: list[AnalysisResult] = []

    with transaction.atomic():
        ensure_default_parameters()
        for item in parsed_rows:
            site_id = item.pop('site_id')
            if site_id is not None:
                site, created = Site.objects.update_or_create(site_id=site_id, defaults=item)
            else:
                site, created = Site.objects.update_or_create(
                    site_name=item['site_name'],
                    region=item['region'],
                    defaults=item,
                )
            if created:
                created_count += 1
            else:
                updated_count += 1

            calc = calculator.calculate(
                {
                    'solar_irradiance_kwh': float(site.solar_irradiance_kwh),
                    'area_sqm': int(site.area_sqm),
                    'grid_distance_km': float(site.grid_distance_km),
                    'slope_degrees': float(site.slope_degrees),
                    'road_distance_km': float(site.road_distance_km),
                }
            )
            bd = calc['breakdown']
            results_to_insert.append(
                AnalysisResult(
                    site=site,
                    solar_irradiance_score=Decimal(f"{bd['solar']:.2f}"),
                    area_score=Decimal(f"{bd['area']:.2f}"),
                    grid_distance_score=Decimal(f"{bd['grid']:.2f}"),
                    slope_score=Decimal(f"{bd['slope']:.2f}"),
                    infrastructure_score=Decimal(f"{bd['infrastructure']:.2f}"),
                    total_suitability_score=Decimal(f"{calc['total_suitability_score']:.2f}"),
                    parameters_snapshot=snapshot,
                )
            )

        AnalysisResult.objects.bulk_create(results_to_insert)

    invalidate_stats_cache()
    return {
        'processed': len(parsed_rows),
        'created': created_count,
        'updated': updated_count,
    }
