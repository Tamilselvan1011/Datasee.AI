import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AnalyzeResponse,
  HealthResponse,
  PolygonAnalyzeResponse,
  SiteFilters,
  SiteListResponse,
  SitePayload,
  SolarSite,
  StatisticsResponse,
  UploadResponse,
  WeightConfig,
} from '../models/solar-site.model';

@Injectable({
  providedIn: 'root',
})
export class SolarApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health/`);
  }

  getSites(filters: Partial<SiteFilters> = {}, limit = 200, offset = 0): Observable<SiteListResponse> {
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('offset', String(offset));

    if (filters.min_score !== null && filters.min_score !== undefined) {
      params = params.set('min_score', String(filters.min_score));
    }
    if (filters.max_score !== null && filters.max_score !== undefined) {
      params = params.set('max_score', String(filters.max_score));
    }
    if (filters.region) {
      params = params.set('region', filters.region);
    }
    if (filters.land_type) {
      params = params.set('land_type', filters.land_type);
    }
    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.sort_by) {
      params = params.set('sort_by', filters.sort_by);
    }
    if (filters.sort_order) {
      params = params.set('sort_order', filters.sort_order);
    }

    return this.http.get<SiteListResponse>(`${this.baseUrl}/sites/`, { params });
  }

  getSiteDetail(siteId: number): Observable<SolarSite> {
    return this.http.get<SolarSite>(`${this.baseUrl}/sites/${siteId}/`);
  }

  createSite(payload: SitePayload): Observable<SolarSite> {
    return this.http.post<SolarSite>(`${this.baseUrl}/sites/`, payload);
  }

  updateSite(siteId: number, payload: SitePayload): Observable<SolarSite> {
    return this.http.put<SolarSite>(`${this.baseUrl}/sites/${siteId}/`, payload);
  }

  deleteSite(siteId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/sites/${siteId}/`);
  }

  getWeights(): Observable<{ weights: WeightConfig }> {
    return this.http.get<{ weights: WeightConfig }>(`${this.baseUrl}/weights/`);
  }

  analyzeWeights(weights: WeightConfig, persist = true): Observable<AnalyzeResponse> {
    return this.http.post<AnalyzeResponse>(`${this.baseUrl}/analyze/`, {
      weights,
      persist,
    });
  }

  analyzePolygon(polygon: number[][]): Observable<PolygonAnalyzeResponse> {
    return this.http.post<PolygonAnalyzeResponse>(`${this.baseUrl}/analyze/polygon/`, {
      polygon,
    });
  }

  getStatistics(filters: Partial<SiteFilters> = {}): Observable<StatisticsResponse> {
    let params = new HttpParams();
    if (filters.min_score !== null && filters.min_score !== undefined) {
      params = params.set('min_score', String(filters.min_score));
    }
    if (filters.max_score !== null && filters.max_score !== undefined) {
      params = params.set('max_score', String(filters.max_score));
    }
    if (filters.region) {
      params = params.set('region', filters.region);
    }
    if (filters.land_type) {
      params = params.set('land_type', filters.land_type);
    }
    return this.http.get<StatisticsResponse>(`${this.baseUrl}/statistics/`, { params });
  }

  exportSites(format: 'csv' | 'json', filters: Partial<SiteFilters> = {}): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    if (filters.min_score !== null && filters.min_score !== undefined) {
      params = params.set('min_score', String(filters.min_score));
    }
    if (filters.max_score !== null && filters.max_score !== undefined) {
      params = params.set('max_score', String(filters.max_score));
    }
    if (filters.region) {
      params = params.set('region', filters.region);
    }
    if (filters.land_type) {
      params = params.set('land_type', filters.land_type);
    }
    return this.http.get(`${this.baseUrl}/export/`, {
      params,
      responseType: 'blob',
    });
  }

  uploadCsv(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.baseUrl}/sites/upload/`, formData);
  }
}
