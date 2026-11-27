import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SitePayload, SolarSite } from '../../models/solar-site.model';

@Component({
  selector: 'app-site-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="panel-card" aria-label="Add or Edit Solar Site">
      <div class="panel-header" style="flex-wrap: wrap;">
        <div>
          <h2 class="panel-title">
            {{ editingSite ? 'Edit Site: ' + editingSite.site_name : 'Add New Solar Candidate Site' }}
          </h2>
          <p class="panel-subtitle">
            {{
              editingSite
                ? 'Update spatial or terrain metrics — suitability score recalculates automatically on save.'
                : 'Enter spatial parameters to register and score a new site in MySQL.'
            }}
          </p>
        </div>

        <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; max-width: 100%;">
          <select
            class="form-control form-picker-select"
            [ngModel]="editingSite?.site_id ?? null"
            (ngModelChange)="onPickExisting($event)"
            aria-label="Select site to edit or create new"
          >
            <option [ngValue]="null">+ Create New Site</option>
            @for (s of allSites; track s.site_id) {
              <option [ngValue]="s.site_id">
                Edit #{{ s.site_id }} — {{ s.site_name }} ({{ s.total_suitability_score }})
              </option>
            }
          </select>
          @if (editingSite) {
            <button type="button" class="btn btn-sm" (click)="switchToCreate.emit()">
              + New Site
            </button>
          }
        </div>
      </div>

      @if (errorMessage) {
        <div class="alert-banner alert-error" style="margin-bottom: 0.9rem;">
          <span>{{ errorMessage }}</span>
        </div>
      }

      <form (ngSubmit)="submitForm()" #siteForm="ngForm">
        <div class="site-form-grid">
          <div class="field-group">
            <label for="f-site-name">Site Name *</label>
            <input
              id="f-site-name"
              name="site_name"
              type="text"
              class="form-control"
              required
              maxlength="255"
              placeholder="e.g. Karur Solar Park"
              [(ngModel)]="form.site_name"
            />
          </div>

          <div class="field-group">
            <label for="f-region">Region *</label>
            <input
              id="f-region"
              name="region"
              type="text"
              class="form-control"
              list="regionOptions"
              required
              maxlength="100"
              placeholder="e.g. Tamil Nadu"
              [(ngModel)]="form.region"
            />
            <datalist id="regionOptions">
              @for (reg of availableRegions; track reg) {
                <option [value]="reg"></option>
              }
            </datalist>
          </div>

          <div class="field-group">
            <label for="f-land-type">Land Type *</label>
            <input
              id="f-land-type"
              name="land_type"
              type="text"
              class="form-control"
              list="landTypeOptions"
              required
              maxlength="50"
              placeholder="e.g. Open Land, Wasteland"
              [(ngModel)]="form.land_type"
            />
            <datalist id="landTypeOptions">
              @for (lt of availableLandTypes; track lt) {
                <option [value]="lt"></option>
              }
            </datalist>
          </div>

          <div class="field-group">
            <label for="f-lat">Latitude (-90 to 90) *</label>
            <input
              id="f-lat"
              name="latitude"
              type="number"
              step="0.0001"
              min="-90"
              max="90"
              class="form-control"
              required
              [(ngModel)]="form.latitude"
            />
          </div>

          <div class="field-group">
            <label for="f-lon">Longitude (-180 to 180) *</label>
            <input
              id="f-lon"
              name="longitude"
              type="number"
              step="0.0001"
              min="-180"
              max="180"
              class="form-control"
              required
              [(ngModel)]="form.longitude"
            />
          </div>

          <div class="field-group">
            <label for="f-area">
              <span>Land Area (m²) *</span>
              <span style="color: #64748b;">≈ {{ estimatedMw }} MW</span>
            </label>
            <input
              id="f-area"
              name="area_sqm"
              type="number"
              min="1"
              step="500"
              class="form-control"
              required
              [(ngModel)]="form.area_sqm"
            />
          </div>

          <div class="field-group">
            <label for="f-solar">Solar Irradiance (kWh/m²/day) *</label>
            <input
              id="f-solar"
              name="solar_irradiance_kwh"
              type="number"
              step="0.1"
              min="0"
              max="24"
              class="form-control"
              required
              [(ngModel)]="form.solar_irradiance_kwh"
            />
          </div>

          <div class="field-group">
            <label for="f-grid">Grid Distance (km) *</label>
            <input
              id="f-grid"
              name="grid_distance_km"
              type="number"
              step="0.1"
              min="0"
              class="form-control"
              required
              [(ngModel)]="form.grid_distance_km"
            />
          </div>

          <div class="field-group">
            <label for="f-slope">Terrain Slope (degrees, 0–90) *</label>
            <input
              id="f-slope"
              name="slope_degrees"
              type="number"
              step="0.1"
              min="0"
              max="90"
              class="form-control"
              required
              [(ngModel)]="form.slope_degrees"
            />
          </div>

          <div class="field-group">
            <label for="f-road">Road Distance (km) *</label>
            <input
              id="f-road"
              name="road_distance_km"
              type="number"
              step="0.1"
              min="0"
              class="form-control"
              required
              [(ngModel)]="form.road_distance_km"
            />
          </div>

          <div class="field-group">
            <label for="f-elev">Elevation (m) *</label>
            <input
              id="f-elev"
              name="elevation_m"
              type="number"
              step="1"
              class="form-control"
              required
              [(ngModel)]="form.elevation_m"
            />
          </div>
        </div>

        <div class="site-form-footer">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            @if (editingSite) {
              @if (!confirmDelete) {
                <button
                  type="button"
                  class="btn btn-sm"
                  style="color: #dc2626; border-color: #fecaca;"
                  [disabled]="saving"
                  (click)="confirmDelete = true"
                >
                  Delete Site
                </button>
              } @else {
                <button
                  type="button"
                  class="btn btn-sm"
                  style="background: #dc2626; color: #fff; border-color: #dc2626;"
                  [disabled]="saving"
                  (click)="onConfirmDelete()"
                >
                  Confirm Delete
                </button>
                <button type="button" class="btn btn-sm" (click)="confirmDelete = false">
                  Keep
                </button>
              }
            }
          </div>

          <div class="site-form-actions">
            <button type="button" class="btn" (click)="resetForm()">Reset</button>
            <button type="button" class="btn" (click)="cancel.emit()">Back to Map</button>
            <button
              type="submit"
              class="btn btn-solar"
              [disabled]="siteForm.invalid || saving"
            >
              {{ saving ? 'Saving...' : editingSite ? 'Update & Recalculate' : 'Create & Score Site' }}
            </button>
          </div>
        </div>
      </form>
    </section>
  `,
})
export class SiteFormComponent implements OnChanges {
  @Input() editingSite: SolarSite | null = null;
  @Input() allSites: SolarSite[] = [];
  @Input() availableRegions: string[] = [];
  @Input() availableLandTypes: string[] = [];
  @Input() saving = false;
  @Input() errorMessage = '';

  @Output() save = new EventEmitter<{ siteId: number | null; payload: SitePayload }>();
  @Output() deleteSite = new EventEmitter<number>();
  @Output() selectSiteToEdit = new EventEmitter<number>();
  @Output() switchToCreate = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  confirmDelete = false;
  form: SitePayload = this.emptyPayload();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingSite']) {
      this.confirmDelete = false;
      this.form = this.editingSite ? this.fromSite(this.editingSite) : this.emptyPayload();
    }
  }

  get estimatedMw(): number {
    return Math.round(((this.form.area_sqm || 0) / 10000) * 100) / 100;
  }

  onPickExisting(siteId: number | null): void {
    if (siteId === null) {
      this.switchToCreate.emit();
    } else {
      this.selectSiteToEdit.emit(siteId);
    }
  }

  resetForm(): void {
    this.confirmDelete = false;
    this.form = this.editingSite ? this.fromSite(this.editingSite) : this.emptyPayload();
  }

  submitForm(): void {
    this.save.emit({
      siteId: this.editingSite?.site_id ?? null,
      payload: {
        ...this.form,
        site_name: this.form.site_name.trim(),
        land_type: this.form.land_type.trim(),
        region: this.form.region.trim(),
      },
    });
  }

  onConfirmDelete(): void {
    if (this.editingSite) {
      this.deleteSite.emit(this.editingSite.site_id);
    }
  }

  private emptyPayload(): SitePayload {
    return {
      site_name: '',
      latitude: 11.05,
      longitude: 77.15,
      area_sqm: 50000,
      solar_irradiance_kwh: 5.8,
      grid_distance_km: 1.5,
      slope_degrees: 2.0,
      road_distance_km: 0.5,
      elevation_m: 350,
      land_type: 'Open Land',
      region: 'Tamil Nadu',
    };
  }

  private fromSite(site: SolarSite): SitePayload {
    return {
      site_name: site.site_name,
      latitude: site.latitude,
      longitude: site.longitude,
      area_sqm: site.area_sqm,
      solar_irradiance_kwh: site.solar_irradiance_kwh,
      grid_distance_km: site.grid_distance_km,
      slope_degrees: site.slope_degrees,
      road_distance_km: site.road_distance_km,
      elevation_m: site.elevation_m,
      land_type: site.land_type,
      region: site.region,
    };
  }
}
