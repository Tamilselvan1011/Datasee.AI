from django.test import SimpleTestCase

from sites_api.services import DEFAULT_WEIGHTS, SuitabilityCalculator, get_score_category
from sites_api.services.export_service import _sanitize_csv_cell


class ScoringFormulaTests(SimpleTestCase):
    def setUp(self):
        self.calc = SuitabilityCalculator()

    def test_solar_irradiance_scoring_bands(self):
        self.assertEqual(self.calc.solar_score(6.2), 100.0)
        self.assertEqual(self.calc.solar_score(5.5), 100.0)
        self.assertEqual(self.calc.solar_score(4.5), 60.0)
        self.assertEqual(self.calc.solar_score(3.0), 0.0)
        self.assertEqual(self.calc.solar_score(2.8), 0.0)

    def test_area_scoring_bands(self):
        self.assertEqual(self.calc.area_score(95000), 100.0)
        self.assertEqual(self.calc.area_score(50000), 100.0)
        self.assertEqual(self.calc.area_score(25000), 44.44)
        self.assertEqual(self.calc.area_score(5000), 0.0)
        self.assertEqual(self.calc.area_score(4500), 0.0)

    def test_grid_distance_scoring_bands(self):
        self.assertEqual(self.calc.grid_score(0.5), 100.0)
        self.assertEqual(self.calc.grid_score(1.0), 100.0)
        self.assertEqual(self.calc.grid_score(8.0), 63.16)
        self.assertEqual(self.calc.grid_score(20.0), 0.0)
        self.assertEqual(self.calc.grid_score(25.0), 0.0)

    def test_slope_piecewise_scoring_bands(self):
        self.assertEqual(self.calc.slope_score(2.5), 100.0)
        self.assertEqual(self.calc.slope_score(5.0), 100.0)
        self.assertEqual(self.calc.slope_score(8.0), 85.0)
        self.assertEqual(self.calc.slope_score(15.0), 50.0)
        self.assertEqual(self.calc.slope_score(18.0), 20.0)
        self.assertEqual(self.calc.slope_score(20.0), 0.0)
        self.assertEqual(self.calc.slope_score(25.0), 0.0)

    def test_infrastructure_scoring_bands(self):
        self.assertEqual(self.calc.infrastructure_score(0.2), 100.0)
        self.assertEqual(self.calc.infrastructure_score(0.5), 100.0)
        self.assertEqual(self.calc.infrastructure_score(1.5), 77.78)
        self.assertEqual(self.calc.infrastructure_score(5.0), 0.0)
        self.assertEqual(self.calc.infrastructure_score(6.0), 0.0)

    def test_sulur_airbase_site_full_score(self):
        result = self.calc.calculate(
            {
                'solar_irradiance_kwh': 6.2,
                'area_sqm': 95000,
                'grid_distance_km': 0.5,
                'slope_degrees': 0.8,
                'road_distance_km': 0.2,
            }
        )
        self.assertEqual(result['total_suitability_score'], 100.0)
        self.assertEqual(get_score_category(100.0)['category'], 'Excellent')

    def test_weight_validation_rejects_invalid_sum_or_bounds(self):
        bad_sum = dict(DEFAULT_WEIGHTS, solar=0.50)
        with self.assertRaises(ValueError):
            SuitabilityCalculator(bad_sum)

        bad_range = {
            'solar': -0.1,
            'area': 0.5,
            'grid': 0.3,
            'slope': 0.2,
            'infrastructure': 0.1,
        }
        with self.assertRaises(ValueError):
            SuitabilityCalculator(bad_range)

    def test_csv_formula_injection_sanitization(self):
        self.assertEqual(_sanitize_csv_cell('=CMD()'), "'=CMD()")
        self.assertEqual(_sanitize_csv_cell('+123'), "'+123")
        self.assertEqual(_sanitize_csv_cell('Normal Site'), 'Normal Site')
