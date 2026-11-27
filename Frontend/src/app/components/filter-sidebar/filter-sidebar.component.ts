import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SiteFilters } from '../../models/solar-site.model';

@Component({
  selector: 'app-filter-sidebar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel-card" aria-label="Site Filters">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Site Screening Filters</h2>
          <p class="panel-subtitle">Showing {{ resultCount }} matching sites</p>
        </div>
        <button type="button" class="btn btn-sm" (click)="resetFilters()">Reset</button>
      </div>

      <div class="field-group">
        <label for="searchInput">Search Site / Region</label>
        <input
          id="searchInput"
          type="text"
          class="form-control"
          placeholder="e.g. Sulur, Udumalpet..."
          [ngModel]="filters.search"
          (ngModelChange)="updateField('search', $event)"
        />
      </div>

      <div class="field-group">
        <label for="minScoreRange">
          <span>Min Suitability Score</span>
          <strong>{{ filters.min_score ?? 0 }} / 100</strong>
        </label>
        <input
          id="minScoreRange"
          type="range"
          class="range-slider"
          min="0"
          max="100"
          step="5"
          [ngModel]="filters.min_score ?? 0"
          (ngModelChange)="updateField('min_score', $event > 0 ? $event : null)"
        />
      </div>

      <div class="field-group">
        <label for="landTypeSelect">Land Type</label>
        <select
          id="landTypeSelect"
          class="form-control"
          [ngModel]="filters.land_type"
          (ngModelChange)="updateField('land_type', $event)"
        >
          <option value="">All Land Types</option>
          @for (lt of availableLandTypes; track lt) {
            <option [value]="lt">{{ lt }}</option>
          }
        </select>
      </div>

      <div class="field-group">
        <label for="regionSelect">Region</label>
        <select
          id="regionSelect"
          class="form-control"
          [ngModel]="filters.region"
          (ngModelChange)="updateField('region', $event)"
        >
          <option value="">All Regions</option>
          @for (reg of availableRegions; track reg) {
            <option [value]="reg">{{ reg }}</option>
          }
        </select>
      </div>

      <div class="field-group" style="margin-bottom: 0;">
        <label for="sortBySelect">Sort Order</label>
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.45rem;">
          <select
            id="sortBySelect"
            class="form-control"
            [ngModel]="filters.sort_by"
            (ngModelChange)="updateField('sort_by', $event)"
          >
            <option value="total_suitability_score">Suitability Score</option>
            <option value="area_sqm">Land Area (m²)</option>
            <option value="solar_irradiance_kwh">Solar Irradiance</option>
            <option value="grid_distance_km">Grid Distance</option>
            <option value="slope_degrees">Terrain Slope</option>
            <option value="site_name">Site Name</option>
          </select>
          <button
            type="button"
            class="btn btn-sm"
            (click)="updateField('sort_order', filters.sort_order === 'desc' ? 'asc' : 'desc')"
          >
            {{ filters.sort_order === 'desc' ? 'Desc' : 'Asc' }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class FilterSidebarComponent {
  @Input({ required: true }) filters!: SiteFilters;
  @Input() availableRegions: string[] = [];
  @Input() availableLandTypes: string[] = [];
  @Input() resultCount = 0;

  @Output() filtersChange = new EventEmitter<SiteFilters>();

  updateField<K extends keyof SiteFilters>(key: K, value: SiteFilters[K]): void {
    this.filtersChange.emit({
      ...this.filters,
      [key]: value,
    });
  }

  resetFilters(): void {
    this.filtersChange.emit({
      min_score: null,
      max_score: null,
      region: '',
      land_type: '',
      search: '',
      sort_by: 'total_suitability_score',
      sort_order: 'desc',
    });
  }
}
