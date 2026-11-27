import json
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from sites_api.models import Site


class SolarSiteApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        csv_path = Path(settings.BASE_DIR) / 'sql' / 'solar_sites_data.csv'
        call_command('seed_solar_sites', csv=str(csv_path))

    def test_seed_loaded_all_50_sites(self):
        self.assertEqual(Site.objects.count(), 50)

    def test_health_endpoint(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')
        self.assertEqual(response.data['sites_count'], 50)

    def test_list_sites_filtering_sorting_pagination(self):
        response = self.client.get('/api/sites/', {'min_score': 80, 'limit': 10, 'offset': 0})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data['count'], 0)
        for item in response.data['results']:
            self.assertGreaterEqual(item['total_suitability_score'], 80.0)

        # Invalid min_score > max_score
        bad = self.client.get('/api/sites/', {'min_score': 90, 'max_score': 40})
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_site_detail_and_not_found(self):
        response = self.client.get('/api/sites/9/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['site_name'], 'Sulur Airbase Adjacent')
        self.assertEqual(response.data['total_suitability_score'], 100.0)
        self.assertIn('score_breakdown', response.data)
        self.assertEqual(response.data['rank'], 1)

        missing = self.client.get('/api/sites/99999/')
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

    def test_analyze_with_custom_weights_and_validation(self):
        invalid = self.client.post(
            '/api/analyze/',
            {
                'weights': {
                    'solar': 0.5,
                    'area': 0.5,
                    'grid': 0.2,
                    'slope': 0.1,
                    'infrastructure': 0.1,
                }
            },
            format='json',
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        valid = self.client.post(
            '/api/analyze/',
            {
                'weights': {
                    'solar': 0.50,
                    'area': 0.20,
                    'grid': 0.15,
                    'slope': 0.10,
                    'infrastructure': 0.05,
                },
                'persist': False,
            },
            format='json',
        )
        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        self.assertEqual(valid.data['total_sites'], 50)
        self.assertEqual(valid.data['weights_used']['solar'], 0.5)

    def test_polygon_analyze_endpoint(self):
        # Bounding box covering Coimbatore/Sulur region
        response = self.client.post(
            '/api/analyze/polygon/',
            {
                'polygon': [
                    [10.90, 76.85],
                    [10.90, 77.25],
                    [11.20, 77.25],
                    [11.20, 76.85],
                ]
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data['matched_count'], 0)

    def test_statistics_endpoint(self):
        response = self.client.get('/api/statistics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_sites'], 50)
        self.assertEqual(len(response.data['top_10_sites']), 10)
        self.assertEqual(len(response.data['score_distribution']), 5)
        self.assertGreater(len(response.data['by_land_type']), 1)

    def test_export_csv_and_json(self):
        csv_resp = self.client.get('/api/export/', {'format': 'csv', 'min_score': 80})
        self.assertEqual(csv_resp.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', csv_resp['Content-Type'])
        content = csv_resp.content.decode('utf-8')
        self.assertIn('Sulur Airbase Adjacent', content)

        json_resp = self.client.get('/api/export/', {'format': 'json', 'min_score': 80})
        self.assertEqual(json_resp.status_code, status.HTTP_200_OK)
        parsed = json.loads(json_resp.content.decode('utf-8'))
        self.assertGreater(parsed['count'], 0)

        bad_fmt = self.client.get('/api/export/', {'format': 'xlsx'})
        self.assertEqual(bad_fmt.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_csv_endpoint(self):
        csv_bytes = (
            b'site_name,latitude,longitude,area_sqm,solar_irradiance_kwh,'
            b'grid_distance_km,slope_degrees,road_distance_km,elevation_m,land_type,region\n'
            b'Test Solar Hub,11.1000,77.1000,60000,5.9,1.0,2.0,0.4,350,Open Land,Tamil Nadu\n'
        )
        upload = SimpleUploadedFile('new_sites.csv', csv_bytes, content_type='text/csv')
        # Unauthenticated upload is rejected
        unauth = self.client.post('/api/sites/upload/', {'file': upload}, format='multipart')
        self.assertEqual(unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Register & authenticate
        reg = self.client.post(
            '/api/auth/register/',
            {'username': 'uploader', 'password': 'Password123!', 'email': 'u@example.com'},
            format='json',
        )
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")

        # Dry-run preview returns parsed rows without creating records
        preview_file = SimpleUploadedFile('new_sites.csv', csv_bytes, content_type='text/csv')
        preview_resp = self.client.post(
            '/api/sites/upload/',
            {'file': preview_file, 'preview': 'true'},
            format='multipart',
        )
        self.assertEqual(preview_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(preview_resp.data['preview'])
        self.assertEqual(preview_resp.data['created'], 1)
        self.assertEqual(preview_resp.data['rows'][0]['action'], 'create')
        self.assertEqual(Site.objects.count(), 50)

        upload2 = SimpleUploadedFile('new_sites.csv', csv_bytes, content_type='text/csv')
        response = self.client.post('/api/sites/upload/', {'file': upload2}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 1)
        self.assertEqual(Site.objects.count(), 51)
        self.client.credentials()

    def test_auth_flow_and_create_update_delete_site(self):
        # Register & verify login + /api/auth/me/
        reg = self.client.post(
            '/api/auth/register/',
            {'username': 'solar_eng', 'password': 'Password123!', 'first_name': 'Solar'},
            format='json',
        )
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', reg.data)

        login = self.client.post(
            '/api/auth/login/',
            {'username': 'solar_eng', 'password': 'Password123!'},
            format='json',
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        token = login.data['access']

        payload = {
            'site_name': 'Karur Solar Expansion',
            'latitude': 10.9601,
            'longitude': 78.0766,
            'area_sqm': 75000,
            'solar_irradiance_kwh': 6.0,
            'grid_distance_km': 0.9,
            'slope_degrees': 1.5,
            'road_distance_km': 0.4,
            'elevation_m': 140,
            'land_type': 'Open Land',
            'region': 'Tamil Nadu',
        }
        # Unauthenticated create returns 401
        self.assertEqual(
            self.client.post('/api/sites/', payload, format='json').status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        # Authenticated create/update/delete succeeds
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data['username'], 'solar_eng')

        create_resp = self.client.post('/api/sites/', payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_resp.data['total_suitability_score'], 100.0)
        new_id = create_resp.data['site_id']

        bad_resp = self.client.post('/api/sites/', {**payload, 'latitude': 120.0}, format='json')
        self.assertEqual(bad_resp.status_code, status.HTTP_400_BAD_REQUEST)

        patch_resp = self.client.patch(
            f'/api/sites/{new_id}/',
            {'solar_irradiance_kwh': 4.5, 'site_name': 'Karur Solar Updated'},
            format='json',
        )
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['site_name'], 'Karur Solar Updated')
        self.assertLess(patch_resp.data['total_suitability_score'], 100.0)

        del_resp = self.client.delete(f'/api/sites/{new_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get(f'/api/sites/{new_id}/').status_code, status.HTTP_404_NOT_FOUND)
        self.client.credentials()
