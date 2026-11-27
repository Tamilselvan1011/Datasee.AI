import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { SolarApiService } from './services/solar-api.service';

describe('App & SolarApiService', () => {
  let httpMock: HttpTestingController;
  let apiService: SolarApiService;
  let authService: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    apiService = TestBed.inject(SolarApiService);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should show login screen first when unauthenticated', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-page')).toBeTruthy();
    expect(compiled.querySelector('.top-navbar')).toBeNull();
  });

  it('should load main workspace when authenticated', () => {
    localStorage.setItem('solar_access_token', 'valid-token');
    localStorage.setItem(
      'solar_auth_user',
      JSON.stringify({ id: 1, username: 'demo', email: '', first_name: '', last_name: '', is_staff: false }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const localMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    localMock.expectOne('http://localhost:8000/api/auth/me/').flush({
      id: 1,
      username: 'demo',
      email: '',
      first_name: '',
      last_name: '',
      is_staff: false,
    });
    localMock.expectOne('http://localhost:8000/api/health/').flush({
      status: 'ok',
      database: 'connected',
      sites_count: 50,
    });
    localMock
      .expectOne((req) => req.url === 'http://localhost:8000/api/sites/')
      .flush({
        count: 0,
        limit: 500,
        offset: 0,
        available_regions: ['Tamil Nadu'],
        available_land_types: ['Open Land'],
        weights_used: { solar: 0.35, area: 0.25, grid: 0.2, slope: 0.15, infrastructure: 0.05 },
        results: [],
      });
    localMock
      .expectOne((req) => req.url === 'http://localhost:8000/api/statistics/')
      .flush({
        total_sites: 0,
        avg_score: 0,
        min_score: 0,
        max_score: 0,
        std_dev: 0,
        total_area_sqm: 0,
        total_potential_mw: 0,
        weights_used: { solar: 0.35, area: 0.25, grid: 0.2, slope: 0.15, infrastructure: 0.05 },
        score_distribution: [],
        by_land_type: [],
        by_region: [],
        top_10_sites: [],
      });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Solar Panel Site Analyzer');
    localMock.verify();
  });

  it('should send custom weights to POST /api/analyze/', () => {
    const weights = { solar: 0.5, area: 0.2, grid: 0.15, slope: 0.1, infrastructure: 0.05 };
    apiService.analyzeWeights(weights, true).subscribe((res) => {
      expect(res.persisted).toBe(true);
    });

    const req = httpMock.expectOne('http://localhost:8000/api/analyze/');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ weights, persist: true });
    req.flush({ persisted: true, weights_used: weights, total_sites: 50, average_score: 80, results: [] });
  });

  it('should pass filter query parameters and CRUD calls to /api/sites/', () => {
    apiService
      .getSites({ min_score: 75, land_type: 'Open Land', region: 'Tamil Nadu', sort_by: 'area_sqm', sort_order: 'desc' })
      .subscribe();

    const listReq = httpMock.expectOne((r) => r.url === 'http://localhost:8000/api/sites/');
    expect(listReq.request.params.get('min_score')).toBe('75');
    listReq.flush({
      count: 0,
      limit: 200,
      offset: 0,
      available_regions: [],
      available_land_types: [],
      weights_used: { solar: 0.35, area: 0.25, grid: 0.2, slope: 0.15, infrastructure: 0.05 },
      results: [],
    });

    const payload = {
      site_name: 'Karur Solar Park',
      latitude: 10.96,
      longitude: 78.07,
      area_sqm: 70000,
      solar_irradiance_kwh: 6.0,
      grid_distance_km: 1.0,
      slope_degrees: 1.5,
      road_distance_km: 0.5,
      elevation_m: 140,
      land_type: 'Open Land',
      region: 'Tamil Nadu',
    };

    apiService.createSite(payload).subscribe((site) => {
      expect(site.site_name).toBe('Karur Solar Park');
    });
    const createReq = httpMock.expectOne('http://localhost:8000/api/sites/');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ ...payload, site_id: 51, total_suitability_score: 100 });
  });

  it('should store JWT token on login and attach Bearer header to protected requests', () => {
    authService.login({ username: 'demo', password: 'Password123!' }).subscribe((res) => {
      expect(res.user.username).toBe('demo');
    });

    const loginReq = httpMock.expectOne('http://localhost:8000/api/auth/login/');
    expect(loginReq.request.method).toBe('POST');
    loginReq.flush({
      access: 'jwt-access-123',
      refresh: 'jwt-refresh-456',
      user: { id: 1, username: 'demo', email: '', first_name: '', last_name: '', is_staff: false },
    });

    expect(authService.isAuthenticated()).toBe(true);

    apiService.deleteSite(51).subscribe();
    const delReq = httpMock.expectOne('http://localhost:8000/api/sites/51/');
    expect(delReq.request.headers.get('Authorization')).toBe('Bearer jwt-access-123');
    delReq.flush(null);

    authService.logout();
    expect(authService.isAuthenticated()).toBe(false);
  });
});
