import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UploadResponse } from '../../models/solar-site.model';

@Component({
  selector: 'app-csv-upload-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div
        class="modal-card"
        [class.modal-card-wide]="previewData !== null"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-label="Upload Spatial Site Dataset"
      >
        <div class="panel-header" style="align-items: flex-start; flex-wrap: nowrap;">
          <div style="flex: 1; min-width: 0;">
            <h2 class="panel-title">Upload Spatial Site Dataset (.CSV)</h2>
            <p class="panel-subtitle">
              Required columns: site_name, latitude, longitude, area_sqm, solar_irradiance_kwh,
              grid_distance_km, slope_degrees, road_distance_km, elevation_m, land_type, region
            </p>
          </div>
          <button type="button" class="btn btn-sm" (click)="close.emit()">Close</button>
        </div>

        <div
          style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 0.85rem;"
        >
          <span style="font-size: 0.78rem; color: #475569;">
            Need the exact CSV template? Download and edit the sample dataset.
          </span>
          <a
            href="sample_solar_sites.csv"
            download="sample_solar_sites.csv"
            class="btn btn-sm"
            style="text-decoration: none;"
          >
            Download Sample CSV
          </a>
        </div>

        <div class="field-group">
          <label for="csvFileInput">Select CSV File (max 5 MB)</label>
          <input
            id="csvFileInput"
            type="file"
            accept=".csv,text/csv"
            class="form-control"
            (change)="onFileSelected($event)"
          />
        </div>

        @if (errorMessage) {
          <div class="alert-banner alert-error" style="margin-bottom: 0.75rem;">
            {{ errorMessage }}
          </div>
        }

        @if (previewing) {
          <div class="alert-banner alert-info" style="margin-bottom: 0.75rem;">
            Validating CSV columns and computing suitability preview...
          </div>
        }

        @if (previewData && previewData.rows) {
          <div
            style="display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; margin-bottom: 0.65rem;"
          >
            <span class="risk-badge risk-ok" style="margin: 0;">
              Total Rows: {{ previewData.processed }}
            </span>
            <span class="risk-badge risk-ok" style="margin: 0;">
              New Sites: {{ previewData.created }}
            </span>
            <span class="risk-badge risk-warn" style="margin: 0;">
              Updates: {{ previewData.updated }}
            </span>
          </div>

          <div
            class="table-wrap"
            style="max-height: 290px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 0.85rem;"
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Site Name</th>
                  <th>Region</th>
                  <th>Land Type</th>
                  <th>Area (m² / MW)</th>
                  <th>Solar</th>
                  <th>Grid</th>
                  <th>Slope</th>
                  <th>Est. Score</th>
                </tr>
              </thead>
              <tbody>
                @for (row of previewData.rows; track row.row_number) {
                  <tr>
                    <td>{{ row.row_number }}</td>
                    <td>
                      <span
                        class="risk-badge"
                        [class.risk-ok]="row.action === 'create'"
                        [class.risk-warn]="row.action === 'update'"
                        style="margin: 0; text-transform: uppercase;"
                      >
                        {{ row.action === 'create' ? 'New' : 'Update' }}
                      </span>
                    </td>
                    <td><strong>{{ row.site_name }}</strong></td>
                    <td>{{ row.region }}</td>
                    <td>{{ row.land_type }}</td>
                    <td>{{ row.area_sqm | number }} m² ({{ row.estimated_capacity_mw }} MW)</td>
                    <td>{{ row.solar_irradiance_kwh }}</td>
                    <td>{{ row.grid_distance_km }} km</td>
                    <td>{{ row.slope_degrees }}°</td>
                    <td>
                      <span class="score-pill" [style.background]="row.color">
                        {{ row.total_suitability_score }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div style="display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 0.5rem;">
          <button type="button" class="btn" (click)="close.emit()">Cancel</button>
          @if (!previewData) {
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="!selectedFile || previewing"
              (click)="requestPreview()"
            >
              {{ previewing ? 'Previewing...' : 'Preview CSV' }}
            </button>
          } @else {
            <button
              type="button"
              class="btn"
              [disabled]="uploading || previewing"
              (click)="requestPreview()"
            >
              Re-Validate
            </button>
            <button
              type="button"
              class="btn btn-solar"
              [disabled]="!selectedFile || uploading || previewing"
              (click)="confirmSave()"
            >
              {{ uploading ? 'Saving...' : 'Confirm & Save (' + previewData.processed + ' sites)' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class CsvUploadModalComponent {
  @Input() previewing = false;
  @Input() uploading = false;
  @Input() errorMessage = '';
  @Input() previewData: UploadResponse | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() previewRequested = new EventEmitter<File>();
  @Output() confirmUpload = new EventEmitter<File>();
  @Output() fileCleared = new EventEmitter<void>();

  selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    this.fileCleared.emit();
    if (this.selectedFile) {
      this.previewRequested.emit(this.selectedFile);
    }
  }

  requestPreview(): void {
    if (this.selectedFile) {
      this.previewRequested.emit(this.selectedFile);
    }
  }

  confirmSave(): void {
    if (this.selectedFile && this.previewData) {
      this.confirmUpload.emit(this.selectedFile);
    }
  }
}
