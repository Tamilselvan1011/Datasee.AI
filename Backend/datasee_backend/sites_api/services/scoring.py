from decimal import Decimal
from typing import Any

DEFAULT_WEIGHTS: dict[str, float] = {
    'solar': 0.35,
    'area': 0.25,
    'grid': 0.20,
    'slope': 0.15,
    'infrastructure': 0.05,
}

WEIGHT_DB_MAPPING: dict[str, str] = {
    'solar': 'solar_irradiance_weight',
    'area': 'area_weight',
    'grid': 'grid_distance_weight',
    'slope': 'slope_weight',
    'infrastructure': 'infrastructure_weight',
}

SCORE_CATEGORIES: list[tuple[float, str, str, str]] = [
    (80.0, 'Excellent', 'Prioritize for development', '#16a34a'),
    (60.0, 'Good', 'Viable with standard conditions', '#65a30d'),
    (40.0, 'Fair', 'Viable with mitigation measures', '#eab308'),
    (20.0, 'Poor', 'High-risk, detailed study needed', '#f97316'),
    (0.0, 'Very Poor', 'Not recommended', '#dc2626'),
]


def _to_float(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def get_score_category(score: float) -> dict[str, str]:
    """Return classification label, recommendation, and map color for a 0-100 score."""
    numeric_score = _to_float(score)
    for threshold, label, recommendation, color in SCORE_CATEGORIES:
        if numeric_score >= threshold:
            return {
                'category': label,
                'recommendation': recommendation,
                'color': color,
            }
    return {
        'category': 'Very Poor',
        'recommendation': 'Not recommended',
        'color': '#dc2626',
    }


def estimate_capacity_mw(area_sqm: int | float) -> float:
    """Estimate solar capacity in MW assuming ~10,000 m² per MW at 50% GCR."""
    return round(_to_float(area_sqm) / 10000.0, 2)


def area_in_acres(area_sqm: int | float) -> float:
    """Convert square meters to acres."""
    return round(_to_float(area_sqm) * 0.000247105, 2)


class SuitabilityCalculator:
    """Calculates individual factor scores (0-100) and weighted total suitability."""

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = dict(weights) if weights is not None else dict(DEFAULT_WEIGHTS)
        self.validate_weights(self.weights)

    @staticmethod
    def validate_weights(weights: dict[str, float]) -> None:
        required_keys = set(DEFAULT_WEIGHTS.keys())
        if set(weights.keys()) != required_keys:
            missing = required_keys - set(weights.keys())
            extra = set(weights.keys()) - required_keys
            raise ValueError(f'Invalid weight keys. Missing: {sorted(missing)}, Extra: {sorted(extra)}')

        for key, value in weights.items():
            if not (0.0 <= float(value) <= 1.0):
                raise ValueError(f'Weight "{key}" must be between 0 and 1, got {value}')

        total = sum(float(v) for v in weights.values())
        if abs(total - 1.0) >= 0.001:
            raise ValueError(f'Weights must sum to 1.0, got {total:.4f}')

    @staticmethod
    def solar_score(solar_irradiance_kwh: float) -> float:
        x = _to_float(solar_irradiance_kwh)
        if x >= 5.5:
            return 100.0
        if x < 3.0:
            return 0.0
        return round(((x - 3.0) / 2.5) * 100.0, 2)

    @staticmethod
    def area_score(area_sqm: float) -> float:
        x = _to_float(area_sqm)
        if x >= 50000.0:
            return 100.0
        if x < 5000.0:
            return 0.0
        return round(((x - 5000.0) / 45000.0) * 100.0, 2)

    @staticmethod
    def grid_score(grid_distance_km: float) -> float:
        x = _to_float(grid_distance_km)
        if x <= 1.0:
            return 100.0
        if x >= 20.0:
            return 0.0
        return round(100.0 - ((x - 1.0) / 19.0) * 100.0, 2)

    @staticmethod
    def slope_score(slope_degrees: float) -> float:
        x = _to_float(slope_degrees)
        if x <= 5.0:
            return 100.0
        if x > 20.0:
            return 0.0
        if x <= 15.0:
            return round(100.0 - ((x - 5.0) / 10.0) * 50.0, 2)
        return round(50.0 - ((x - 15.0) / 5.0) * 50.0, 2)

    @staticmethod
    def infrastructure_score(road_distance_km: float) -> float:
        x = _to_float(road_distance_km)
        if x <= 0.5:
            return 100.0
        if x >= 5.0:
            return 0.0
        return round(100.0 - ((x - 0.5) / 4.5) * 100.0, 2)

    def calculate(self, site_data: dict[str, Any]) -> dict[str, Any]:
        """Compute sub-scores, weighted contributions, and total suitability score."""
        breakdown = {
            'solar': self.solar_score(site_data['solar_irradiance_kwh']),
            'area': self.area_score(site_data['area_sqm']),
            'grid': self.grid_score(site_data['grid_distance_km']),
            'slope': self.slope_score(site_data['slope_degrees']),
            'infrastructure': self.infrastructure_score(site_data['road_distance_km']),
        }
        weighted_contributions = {
            key: round(breakdown[key] * float(self.weights[key]), 2)
            for key in breakdown
        }
        total = round(
            sum(breakdown[key] * float(self.weights[key]) for key in breakdown),
            2,
        )
        return {
            'total_suitability_score': total,
            'breakdown': breakdown,
            'weighted_contributions': weighted_contributions,
        }
