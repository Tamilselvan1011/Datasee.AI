from collections import defaultdict
from decimal import Decimal
import math
from typing import Any

from django.core.cache import cache
from django.db import transaction

from ..models import AnalysisParameter, AnalysisResult, Site
from .scoring import (
    DEFAULT_WEIGHTS,
    WEIGHT_DB_MAPPING,
    SuitabilityCalculator,
    area_in_acres,
    estimate_capacity_mw,
    get_score_category,
)

ALLOWED_SORT_FIELDS = {
    'site_id',
    'site_name',
    'area_sqm',
    'solar_irradiance_kwh',
    'grid_distance_km',
    'slope_degrees',
    'road_distance_km',
    'elevation_m',
    'total_suitability_score',
}

STATS_CACHE_VERSION_KEY = 'solar_stats_version'


def invalidate_stats_cache() -> None:
    """Bump the stats cache version so stale aggregations expire cleanly."""
    version = cache.get(STATS_CACHE_VERSION_KEY, 1)
    cache.set(STATS_CACHE_VERSION_KEY, version + 1, timeout=None)


def get_active_weights() -> dict[str, float]:
    """Return active factor weights from analysis_parameters, falling back to defaults."""
    reverse_map = {db_name: api_key for api_key, db_name in WEIGHT_DB_MAPPING.items()}
    params = AnalysisParameter.objects.filter(is_active=True)
    weights = dict(DEFAULT_WEIGHTS)
    found = {}
    for param in params:
        api_key = reverse_map.get(param.parameter_name)
        if api_key:
            found[api_key] = float(param.weight_value)
    if len(found) == len(DEFAULT_WEIGHTS):
        try:
            SuitabilityCalculator.validate_weights(found)
            return found
        except ValueError:
            return weights
    return weights


def _serialize_site_record(
    site: Site,
    result: AnalysisResult | None,
    weights: dict[str, float],
) -> dict[str, Any]:
    """Merge a Site ORM row with its latest AnalysisResult (or computed fallback)."""
    site_inputs = {
        'solar_irradiance_kwh': float(site.solar_irradiance_kwh),
        'area_sqm': int(site.area_sqm),
        'grid_distance_km': float(site.grid_distance_km),
        'slope_degrees': float(site.slope_degrees),
        'road_distance_km': float(site.road_distance_km),
    }

    if result is not None:
        breakdown = {
            'solar': float(result.solar_irradiance_score),
            'area': float(result.area_score),
            'grid': float(result.grid_distance_score),
            'slope': float(result.slope_score),
            'infrastructure': float(result.infrastructure_score),
        }
        total_score = float(result.total_suitability_score)
        snapshot = result.parameters_snapshot or weights
        used_weights = {
            'solar': float(snapshot.get('solar_weight', snapshot.get('solar', weights['solar']))),
            'area': float(snapshot.get('area_weight', snapshot.get('area', weights['area']))),
            'grid': float(snapshot.get('grid_weight', snapshot.get('grid', weights['grid']))),
            'slope': float(snapshot.get('slope_weight', snapshot.get('slope', weights['slope']))),
            'infrastructure': float(
                snapshot.get('infra_weight', snapshot.get('infrastructure', weights['infrastructure']))
            ),
        }
        analysis_timestamp = result.analysis_timestamp.isoformat() if result.analysis_timestamp else None
    else:
        calc = SuitabilityCalculator(weights).calculate(site_inputs)
        breakdown = calc['breakdown']
        total_score = calc['total_suitability_score']
        used_weights = dict(weights)
        analysis_timestamp = None

    weighted_contributions = {
        k: round(breakdown[k] * used_weights[k], 2) for k in breakdown
    }
    category_info = get_score_category(total_score)

    return {
        'site_id': site.site_id,
        'site_name': site.site_name,
        'latitude': float(site.latitude),
        'longitude': float(site.longitude),
        'area_sqm': int(site.area_sqm),
        'area_acres': area_in_acres(site.area_sqm),
        'estimated_capacity_mw': estimate_capacity_mw(site.area_sqm),
        'solar_irradiance_kwh': float(site.solar_irradiance_kwh),
        'grid_distance_km': float(site.grid_distance_km),
        'slope_degrees': float(site.slope_degrees),
        'road_distance_km': float(site.road_distance_km),
        'elevation_m': int(site.elevation_m),
        'land_type': site.land_type,
        'region': site.region,
        'solar_irradiance_score': breakdown['solar'],
        'area_score': breakdown['area'],
        'grid_distance_score': breakdown['grid'],
        'slope_score': breakdown['slope'],
        'infrastructure_score': breakdown['infrastructure'],
        'total_suitability_score': total_score,
        'category': category_info['category'],
        'recommendation': category_info['recommendation'],
        'color': category_info['color'],
        'score_breakdown': breakdown,
        'weighted_contributions': weighted_contributions,
        'weights_used': used_weights,
        'analysis_timestamp': analysis_timestamp,
    }


def _assign_ranks(records: list[dict[str, Any]]) -> None:
    """Assign 1-based competition ranks matching SQL get_site_rank() (ties share rank)."""
    ranked = sorted(
        records,
        key=lambda item: (-item['total_suitability_score'], item['site_id']),
    )
    total_count = len(ranked)
    prev_score: float | None = None
    current_rank = 0
    for idx, item in enumerate(ranked, start=1):
        score = item['total_suitability_score']
        if prev_score is None or score < prev_score:
            current_rank = idx
            prev_score = score
        item['rank'] = current_rank
        item['total_sites_ranked'] = total_count


def _fetch_all_scored_sites() -> list[dict[str, Any]]:
    """Load all sites with their latest deterministic AnalysisResult and global rank."""
    weights = get_active_weights()
    sites = list(Site.objects.all().order_by('site_id'))

    latest_results: dict[int, AnalysisResult] = {}
    for res in AnalysisResult.objects.all().order_by('-analysis_timestamp', '-result_id'):
        if res.site_id not in latest_results:
            latest_results[res.site_id] = res

    records = [
        _serialize_site_record(site, latest_results.get(site.site_id), weights)
        for site in sites
    ]
    _assign_ranks(records)
    return records


def _apply_filters(
    records: list[dict[str, Any]],
    min_score: float | None = None,
    max_score: float | None = None,
    region: str | None = None,
    land_type: str | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    filtered = records
    if min_score is not None:
        filtered = [r for r in filtered if r['total_suitability_score'] >= min_score]
    if max_score is not None:
        filtered = [r for r in filtered if r['total_suitability_score'] <= max_score]
    if region:
        region_lower = region.strip().lower()
        filtered = [r for r in filtered if r['region'].lower() == region_lower]
    if land_type:
        land_lower = land_type.strip().lower()
        filtered = [r for r in filtered if r['land_type'].lower() == land_lower]
    if search:
        search_lower = search.strip().lower()
        filtered = [
            r
            for r in filtered
            if search_lower in r['site_name'].lower()
            or search_lower in r['land_type'].lower()
            or search_lower in r['region'].lower()
        ]
    return filtered


def list_sites_with_scores(
    min_score: float | None = None,
    max_score: float | None = None,
    region: str | None = None,
    land_type: str | None = None,
    search: str | None = None,
    sort_by: str = 'total_suitability_score',
    sort_order: str = 'desc',
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Return filtered, sorted, paginated sites with scores and filter facets."""
    all_records = _fetch_all_scored_sites()
    filtered = _apply_filters(
        all_records,
        min_score=min_score,
        max_score=max_score,
        region=region,
        land_type=land_type,
        search=search,
    )

    safe_sort_by = sort_by if sort_by in ALLOWED_SORT_FIELDS else 'total_suitability_score'
    reverse = sort_order.lower() != 'asc'
    filtered.sort(
        key=lambda item: (
            item[safe_sort_by].lower()
            if isinstance(item[safe_sort_by], str)
            else item[safe_sort_by]
        ),
        reverse=reverse,
    )

    total = len(filtered)
    paginated = filtered[offset : offset + limit]

    return {
        'count': total,
        'limit': limit,
        'offset': offset,
        'available_regions': sorted({r['region'] for r in all_records}),
        'available_land_types': sorted({r['land_type'] for r in all_records}),
        'weights_used': get_active_weights(),
        'results': paginated,
    }


def get_site_detail(site_id: int) -> dict[str, Any] | None:
    """Return full site details, score breakdown, and global rank for a single site."""
    target_id = int(site_id)
    all_records = _fetch_all_scored_sites()
    for record in all_records:
        if record['site_id'] == target_id:
            return record
    return None


def recalculate_all_sites(
    weights: dict[str, float],
    persist: bool = True,
) -> dict[str, Any]:
    """Recalculate suitability scores across all sites with custom weights."""
    calculator = SuitabilityCalculator(weights)
    sites = list(Site.objects.all().order_by('site_id'))

    snapshot = {
        'solar_weight': round(float(weights['solar']), 3),
        'area_weight': round(float(weights['area']), 3),
        'grid_weight': round(float(weights['grid']), 3),
        'slope_weight': round(float(weights['slope']), 3),
        'infra_weight': round(float(weights['infrastructure']), 3),
    }

    if persist and sites:
        with transaction.atomic():
            # Update active analysis_parameters weights to reflect the latest run
            for api_key, db_name in WEIGHT_DB_MAPPING.items():
                AnalysisParameter.objects.update_or_create(
                    parameter_name=db_name,
                    defaults={
                        'weight_value': Decimal(str(round(float(weights[api_key]), 3))),
                        'is_active': True,
                    },
                )

            new_results = []
            for site in sites:
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
                new_results.append(
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
            AnalysisResult.objects.bulk_create(new_results)
        invalidate_stats_cache()
        records = _fetch_all_scored_sites()
    else:
        records = []
        for site in sites:
            calc = calculator.calculate(
                {
                    'solar_irradiance_kwh': float(site.solar_irradiance_kwh),
                    'area_sqm': int(site.area_sqm),
                    'grid_distance_km': float(site.grid_distance_km),
                    'slope_degrees': float(site.slope_degrees),
                    'road_distance_km': float(site.road_distance_km),
                }
            )
            fake_result = AnalysisResult(
                site=site,
                solar_irradiance_score=Decimal(f"{calc['breakdown']['solar']:.2f}"),
                area_score=Decimal(f"{calc['breakdown']['area']:.2f}"),
                grid_distance_score=Decimal(f"{calc['breakdown']['grid']:.2f}"),
                slope_score=Decimal(f"{calc['breakdown']['slope']:.2f}"),
                infrastructure_score=Decimal(f"{calc['breakdown']['infrastructure']:.2f}"),
                total_suitability_score=Decimal(f"{calc['total_suitability_score']:.2f}"),
                parameters_snapshot=snapshot,
            )
            records.append(_serialize_site_record(site, fake_result, weights))

        _assign_ranks(records)

    records.sort(key=lambda r: (-r['total_suitability_score'], r['site_id']))
    scores = [r['total_suitability_score'] for r in records]
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

    return {
        'persisted': persist,
        'weights_used': {k: round(float(v), 3) for k, v in weights.items()},
        'total_sites': len(records),
        'average_score': avg_score,
        'results': records,
    }


def compute_statistics(
    min_score: float | None = None,
    max_score: float | None = None,
    region: str | None = None,
    land_type: str | None = None,
) -> dict[str, Any]:
    """Compute summary statistics, score distribution bands, breakdowns, and Top 10."""
    version = cache.get(STATS_CACHE_VERSION_KEY, 1)
    cache_key = f'solar_stats:v{version}:{min_score}:{max_score}:{region}:{land_type}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    records = _apply_filters(
        _fetch_all_scored_sites(),
        min_score=min_score,
        max_score=max_score,
        region=region,
        land_type=land_type,
    )

    total_sites = len(records)
    if total_sites == 0:
        empty_payload = {
            'total_sites': 0,
            'avg_score': 0.0,
            'min_score': 0.0,
            'max_score': 0.0,
            'std_dev': 0.0,
            'total_area_sqm': 0,
            'total_potential_mw': 0.0,
            'weights_used': get_active_weights(),
            'score_distribution': [
                {'label': 'Excellent (80-100)', 'min': 80, 'max': 100, 'count': 0, 'color': '#16a34a'},
                {'label': 'Good (60-79)', 'min': 60, 'max': 79.99, 'count': 0, 'color': '#65a30d'},
                {'label': 'Fair (40-59)', 'min': 40, 'max': 59.99, 'count': 0, 'color': '#eab308'},
                {'label': 'Poor (20-39)', 'min': 20, 'max': 39.99, 'count': 0, 'color': '#f97316'},
                {'label': 'Very Poor (0-19)', 'min': 0, 'max': 19.99, 'count': 0, 'color': '#dc2626'},
            ],
            'by_land_type': [],
            'by_region': [],
            'top_10_sites': [],
        }
        cache.set(cache_key, empty_payload, timeout=300)
        return empty_payload

    scores = [r['total_suitability_score'] for r in records]
    mean = sum(scores) / total_sites
    variance = sum((s - mean) ** 2 for s in scores) / total_sites
    std_dev = round(math.sqrt(variance), 2)

    buckets = [
        {'label': 'Excellent (80-100)', 'min': 80, 'max': 100, 'count': 0, 'color': '#16a34a'},
        {'label': 'Good (60-79)', 'min': 60, 'max': 79.99, 'count': 0, 'color': '#65a30d'},
        {'label': 'Fair (40-59)', 'min': 40, 'max': 59.99, 'count': 0, 'color': '#eab308'},
        {'label': 'Poor (20-39)', 'min': 20, 'max': 39.99, 'count': 0, 'color': '#f97316'},
        {'label': 'Very Poor (0-19)', 'min': 0, 'max': 19.99, 'count': 0, 'color': '#dc2626'},
    ]
    for s in scores:
        if s >= 80:
            buckets[0]['count'] += 1
        elif s >= 60:
            buckets[1]['count'] += 1
        elif s >= 40:
            buckets[2]['count'] += 1
        elif s >= 20:
            buckets[3]['count'] += 1
        else:
            buckets[4]['count'] += 1

    land_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    region_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in records:
        land_groups[r['land_type']].append(r)
        region_groups[r['region']].append(r)

    by_land_type = sorted(
        [
            {
                'land_type': lt,
                'site_count': len(items),
                'avg_score': round(sum(i['total_suitability_score'] for i in items) / len(items), 2),
                'max_score': round(max(i['total_suitability_score'] for i in items), 2),
                'total_potential_mw': round(sum(i['estimated_capacity_mw'] for i in items), 2),
            }
            for lt, items in land_groups.items()
        ],
        key=lambda row: -row['avg_score'],
    )

    by_region = sorted(
        [
            {
                'region': reg,
                'site_count': len(items),
                'avg_score': round(sum(i['total_suitability_score'] for i in items) / len(items), 2),
                'max_score': round(max(i['total_suitability_score'] for i in items), 2),
                'total_potential_mw': round(sum(i['estimated_capacity_mw'] for i in items), 2),
            }
            for reg, items in region_groups.items()
        ],
        key=lambda row: -row['avg_score'],
    )

    top_10 = sorted(records, key=lambda r: (-r['total_suitability_score'], r['site_id']))[:10]

    payload = {
        'total_sites': total_sites,
        'avg_score': round(mean, 2),
        'min_score': round(min(scores), 2),
        'max_score': round(max(scores), 2),
        'std_dev': std_dev,
        'total_area_sqm': sum(r['area_sqm'] for r in records),
        'total_potential_mw': round(sum(r['estimated_capacity_mw'] for r in records), 2),
        'weights_used': get_active_weights(),
        'score_distribution': buckets,
        'by_land_type': by_land_type,
        'by_region': by_region,
        'top_10_sites': top_10,
    }
    cache.set(cache_key, payload, timeout=300)
    return payload


def _point_in_polygon(lat: float, lon: float, polygon: list[list[float]]) -> bool:
    """Ray-casting point-in-polygon test for [lat, lon] vertex rings."""
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        yi, xi = polygon[i][0], polygon[i][1]
        yj, xj = polygon[j][0], polygon[j][1]
        intersects = ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def analyze_sites_in_polygon(polygon: list[list[float]]) -> dict[str, Any]:
    """Filter sites lying inside a custom drawn polygon and summarize potential."""
    records = _fetch_all_scored_sites()
    matched = [
        r for r in records if _point_in_polygon(r['latitude'], r['longitude'], polygon)
    ]
    matched.sort(key=lambda r: (-r['total_suitability_score'], r['site_id']))
    scores = [r['total_suitability_score'] for r in matched]
    return {
        'matched_count': len(matched),
        'average_score': round(sum(scores) / len(scores), 2) if scores else 0.0,
        'total_area_sqm': sum(r['area_sqm'] for r in matched),
        'total_potential_mw': round(sum(r['estimated_capacity_mw'] for r in matched), 2),
        'results': matched,
    }


def create_or_update_site(
    data: dict[str, Any],
    site_id: int | None = None,
) -> dict[str, Any] | None:
    """Create or update a Site and immediately compute and store its suitability score."""
    weights = get_active_weights()
    calculator = SuitabilityCalculator(weights)
    snapshot = {
        'solar_weight': round(float(weights['solar']), 3),
        'area_weight': round(float(weights['area']), 3),
        'grid_weight': round(float(weights['grid']), 3),
        'slope_weight': round(float(weights['slope']), 3),
        'infra_weight': round(float(weights['infrastructure']), 3),
    }

    with transaction.atomic():
        if site_id is not None:
            site = Site.objects.filter(site_id=int(site_id)).first()
            if site is None:
                return None
            for field, value in data.items():
                setattr(site, field, _format_site_field(field, value))
            site.save()
        else:
            formatted = {field: _format_site_field(field, val) for field, val in data.items()}
            site = Site.objects.create(**formatted)

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
        AnalysisResult.objects.create(
            site=site,
            solar_irradiance_score=Decimal(f"{bd['solar']:.2f}"),
            area_score=Decimal(f"{bd['area']:.2f}"),
            grid_distance_score=Decimal(f"{bd['grid']:.2f}"),
            slope_score=Decimal(f"{bd['slope']:.2f}"),
            infrastructure_score=Decimal(f"{bd['infrastructure']:.2f}"),
            total_suitability_score=Decimal(f"{calc['total_suitability_score']:.2f}"),
            parameters_snapshot=snapshot,
        )

    invalidate_stats_cache()
    return get_site_detail(site.site_id)


def _format_site_field(field: str, value: Any) -> Any:
    if field in ('latitude', 'longitude'):
        return Decimal(f'{float(value):.7f}')
    if field in ('solar_irradiance_kwh', 'grid_distance_km', 'slope_degrees', 'road_distance_km'):
        return Decimal(f'{float(value):.2f}')
    if field in ('area_sqm', 'elevation_m'):
        return int(value)
    return str(value).strip()


def delete_site(site_id: int) -> bool:
    """Delete a site and its cascade-linked analysis results."""
    site = Site.objects.filter(site_id=int(site_id)).first()
    if site is None:
        return False
    site.delete()
    invalidate_stats_cache()
    return True
