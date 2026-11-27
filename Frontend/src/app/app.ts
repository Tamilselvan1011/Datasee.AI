import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AnalyticsDashboardComponent } from './components/analytics-dashboard/analytics-dashboard.component';
import { AuthScreenComponent } from './components/auth-screen/auth-screen.component';
import { CsvUploadModalComponent } from './components/csv-upload-modal/csv-upload-modal.component';
import { FilterSidebarComponent } from './components/filter-sidebar/filter-sidebar.component';
import { AppViewTab, NavbarComponent } from './components/navbar/navbar.component';
import { SiteCompareComponent } from './components/site-compare/site-compare.component';
import { SiteDetailDrawerComponent } from './components/site-detail-drawer/site-detail-drawer.component';
import { SiteFormComponent } from './components/site-form/site-form.component';
import { SolarMapComponent } from './components/solar-map/solar-map.component';
import { WeightTunerComponent } from './components/weight-tuner/weight-tuner.component';
import {
  HealthResponse,
  LoginPayload,
  PolygonAnalyzeResponse,
  SiteFilters,
  SitePayload,
  SolarSite,
  StatisticsResponse,
  WeightConfig,
} from './models/solar-site.model';
import { AuthService } from './services/auth.service';
import { SolarApiService } from './services/solar-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    AuthScreenComponent,
    NavbarComponent,
    FilterSidebarComponent,
    WeightTunerComponent,
    SolarMapComponent,
    SiteDetailDrawerComponent,
    AnalyticsDashboardComponent,
    SiteCompareComponent,
    SiteFormComponent,
    CsvUploadModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly api = inject(SolarApiService);
  readonly auth = inject(AuthService);

  readonly activeTab = signal<AppViewTab>('map');
  readonly showMobileControls = signal(false);

  readonly health = signal<HealthResponse | null>(null);
  readonly sites = signal<SolarSite[]>([]);
  readonly allSites = signal<SolarSite[]>([]);
  readonly stats = signal<StatisticsResponse | null>(null);
  readonly selectedSite = signal<SolarSite | null>(null);
  readonly editingSite = signal<SolarSite | null>(null);
  readonly focusSite = signal<SolarSite | null>(null);
  readonly pinnedIds = signal<number[]>([]);
  readonly polygonSummary = signal<PolygonAnalyzeResponse | null>(null);

  readonly availableRegions = signal<string[]>([]);
  readonly availableLandTypes = signal<string[]>([]);
  readonly activeWeights = signal<WeightConfig>({
    solar: 0.35,
    area: 0.25,
    grid: 0.2,
    slope: 0.15,
    infrastructure: 0.05,
  });

  readonly filters = signal<SiteFilters>({
    min_score: null,
    max_score: null,
    region: '',
    land_type: '',
    search: '',
    sort_by: 'total_suitability_score',
    sort_order: 'desc',
  });

  readonly loading = signal(false);
  readonly analyzing = signal(false);
  readonly savingSite = signal(false);
  readonly siteFormError = signal('');
  readonly uploading = signal(false);
  readonly showUploadModal = signal(false);
  readonly uploadError = signal('');
  readonly authBusy = signal(false);
  readonly authError = signal('');
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.enterWorkspace();
      this.auth.loadProfile().subscribe({ error: () => this.onLogout() });
    }
  }

  private enterWorkspace(): void {
    this.loadHealth();
    this.refreshData();
  }

  loadHealth(): void {
    this.api.getHealth().subscribe({
      next: (res) => this.health.set(res),
      error: () => this.health.set({ status: 'offline', database: 'disconnected', sites_count: 0 }),
    });
  }

  refreshData(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    const currentFilters = this.filters();

    forkJoin({
      sitesRes: this.api.getSites(currentFilters, 500, 0),
      statsRes: this.api.getStatistics(currentFilters),
    }).subscribe({
      next: ({ sitesRes, statsRes }) => {
        this.sites.set(sitesRes.results);
        if (this.allSites().length === 0 || !this.hasActiveFilter(currentFilters)) {
          this.allSites.set(sitesRes.results);
        }
        this.availableRegions.set(sitesRes.available_regions);
        this.availableLandTypes.set(sitesRes.available_land_types);
        this.activeWeights.set(sitesRes.weights_used);
        this.stats.set(statsRes);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.error?.detail ||
            'Unable to reach Django API at http://localhost:8000/api/. Make sure the backend server is running.',
        );
      },
    });
  }

  onFiltersChange(updated: SiteFilters): void {
    this.filters.set(updated);
    this.refreshData();
  }

  onRecalculate(event: { weights: WeightConfig; persist: boolean }): void {
    this.analyzing.set(true);
    this.errorMessage.set('');
    this.api.analyzeWeights(event.weights, event.persist).subscribe({
      next: (res) => {
        this.analyzing.set(false);
        this.activeWeights.set(res.weights_used);
        if (event.persist) {
          this.statusMessage.set('Suitability weights saved and all site scores recalculated.');
          this.refreshData();
        } else {
          const f = this.filters();
          const filtered = res.results.filter((site) => {
            if (f.min_score !== null && site.total_suitability_score < f.min_score) return false;
            if (f.region && site.region.toLowerCase() !== f.region.toLowerCase()) return false;
            if (f.land_type && site.land_type.toLowerCase() !== f.land_type.toLowerCase()) return false;
            if (f.search) {
              const q = f.search.toLowerCase();
              if (!site.site_name.toLowerCase().includes(q) && !site.land_type.toLowerCase().includes(q)) {
                return false;
              }
            }
            return true;
          });
          this.sites.set(filtered);
          this.statusMessage.set(
            `Previewing custom weights (Avg score: ${res.average_score}). Click "Apply & Save" to persist.`,
          );
        }
      },
      error: (err) => {
        this.analyzing.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to recalculate weights.');
      },
    });
  }

  onSelectSite(site: SolarSite): void {
    this.selectedSite.set(site);
    this.api.getSiteDetail(site.site_id).subscribe({
      next: (detail) => this.selectedSite.set(detail),
      error: () => {
        // Keep summary already shown in drawer if detail fetch fails
      },
    });
  }

  onLocateOnMap(site: SolarSite): void {
    this.selectedSite.set(site);
    this.activeTab.set('map');
    this.focusSite.set({ ...site });
  }

  onTogglePin(siteId: number): void {
    const current = this.pinnedIds();
    if (current.includes(siteId)) {
      this.pinnedIds.set(current.filter((id) => id !== siteId));
      return;
    }
    if (current.length >= 3) {
      this.statusMessage.set('You can compare up to 3 sites at once. Remove one first.');
      return;
    }
    this.pinnedIds.set([...current, siteId]);
  }

  onPolygonSubmitted(polygon: number[][]): void {
    this.api.analyzePolygon(polygon).subscribe({
      next: (res) => this.polygonSummary.set(res),
      error: () => this.errorMessage.set('Failed to analyze drawn polygon area.'),
    });
  }

  onExport(format: 'csv' | 'json'): void {
    this.api.exportSites(format, this.filters()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `solar_sites_export.${format}`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.errorMessage.set(`Failed to export ${format.toUpperCase()} dataset.`),
    });
  }

  onOpenUploadModal(): void {
    this.uploadError.set('');
    this.showUploadModal.set(true);
  }

  onLoginSubmit(payload: LoginPayload): void {
    this.authBusy.set(true);
    this.authError.set('');
    this.auth.login(payload).subscribe({
      next: (res) => {
        this.authBusy.set(false);
        this.activeTab.set('map');
        this.statusMessage.set(`Welcome, ${res.user.username}.`);
        this.enterWorkspace();
      },
      error: (err) => {
        this.authBusy.set(false);
        this.authError.set(
          err?.error?.detail ||
            (err?.status === 0
              ? 'Unable to reach Django API at http://localhost:8000/api/.'
              : 'Invalid username or password.'),
        );
      },
    });
  }

  onLogout(): void {
    this.auth.logout();
    this.selectedSite.set(null);
    this.editingSite.set(null);
    this.sites.set([]);
    this.allSites.set([]);
    this.stats.set(null);
    this.activeTab.set('map');
  }

  onTabChange(tab: AppViewTab): void {
    this.activeTab.set(tab);
    if (tab === 'manage') {
      this.siteFormError.set('');
    }
  }

  onStartEditSite(site: SolarSite): void {
    this.selectedSite.set(null);
    this.siteFormError.set('');
    this.editingSite.set(site);
    this.activeTab.set('manage');
  }

  onSelectSiteIdToEdit(siteId: number): void {
    const existing =
      this.allSites().find((s) => s.site_id === siteId) ||
      this.sites().find((s) => s.site_id === siteId) ||
      null;
    this.siteFormError.set('');
    this.editingSite.set(existing);
  }

  onSwitchToCreate(): void {
    this.siteFormError.set('');
    this.editingSite.set(null);
  }

  onSaveSite(event: { siteId: number | null; payload: SitePayload }): void {
    this.savingSite.set(true);
    this.siteFormError.set('');

    const req$ =
      event.siteId !== null
        ? this.api.updateSite(event.siteId, event.payload)
        : this.api.createSite(event.payload);

    req$.subscribe({
      next: (saved) => {
        this.savingSite.set(false);
        this.editingSite.set(null);
        this.statusMessage.set(
          `${event.siteId !== null ? 'Updated' : 'Created'} "${saved.site_name}" — Suitability Score: ${saved.total_suitability_score} (${saved.category}).`,
        );
        this.loadHealth();
        this.refreshData();
        this.onLocateOnMap(saved);
      },
      error: (err) => {
        this.savingSite.set(false);
        const firstFieldErr =
          err?.error && typeof err.error === 'object'
            ? Object.values(err.error).flat().join(' ')
            : '';
        this.siteFormError.set(err?.error?.detail || firstFieldErr || 'Failed to save site.');
      },
    });
  }

  onDeleteSite(siteId: number): void {
    this.savingSite.set(true);
    this.siteFormError.set('');
    this.api.deleteSite(siteId).subscribe({
      next: () => {
        this.savingSite.set(false);
        this.editingSite.set(null);
        this.pinnedIds.set(this.pinnedIds().filter((id) => id !== siteId));
        this.statusMessage.set(`Deleted site #${siteId}.`);
        this.activeTab.set('map');
        this.loadHealth();
        this.refreshData();
      },
      error: (err) => {
        this.savingSite.set(false);
        this.siteFormError.set(err?.error?.detail || 'Failed to delete site.');
      },
    });
  }

  onUploadCsv(file: File): void {
    this.uploading.set(true);
    this.uploadError.set('');
    this.api.uploadCsv(file).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.showUploadModal.set(false);
        this.statusMessage.set(
          `Imported ${res.processed} sites (${res.created} created, ${res.updated} updated).`,
        );
        this.loadHealth();
        this.refreshData();
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err?.error?.detail || err?.error?.file?.[0] || 'CSV import failed.');
      },
    });
  }

  private hasActiveFilter(f: SiteFilters): boolean {
    return Boolean(f.min_score !== null || f.max_score !== null || f.region || f.land_type || f.search);
  }
}
