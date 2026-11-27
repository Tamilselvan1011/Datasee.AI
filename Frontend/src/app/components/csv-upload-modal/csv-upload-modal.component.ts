import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-csv-upload-modal',
  standalone: true,
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Upload Spatial Site Dataset (.CSV)</h2>
            <p class="panel-subtitle">
              Required columns: site_name, latitude, longitude, area_sqm, solar_irradiance_kwh,
              grid_distance_km, slope_degrees, road_distance_km, elevation_m, land_type, region
            </p>
          </div>
          <button type="button" class="btn btn-sm" (click)="close.emit()">Close</button>
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

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn" (click)="close.emit()">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="!selectedFile || uploading"
            (click)="submit()"
          >
            {{ uploading ? 'Uploading...' : 'Import & Score Sites' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CsvUploadModalComponent {
  @Input() uploading = false;
  @Input() errorMessage = '';

  @Output() close = new EventEmitter<void>();
  @Output() upload = new EventEmitter<File>();

  selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  submit(): void {
    if (this.selectedFile) {
      this.upload.emit(this.selectedFile);
    }
  }
}
