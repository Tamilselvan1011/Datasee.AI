import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import { SolarSite } from '../../models/solar-site.model';

@Component({
  selector: 'app-site-compare',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <section class="panel-card">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Multi-Site Comparative Analysis</h2>
            <p class="panel-subtitle">Select or pin up to 3 candidate sites to compare side by side</p>
          </div>
          <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; max-width: 100%;">
            <select
              class="form-control form-picker-select"
              [(ngModel)]="addCandidateId"
              (ngModelChange)="addSelectedSite($event)"
            >
              <option [ngValue]="null">+ Add site to compare...</option>
              @for (s of allSites; track s.site_id) {
                <option [ngValue]="s.site_id" [disabled]="pinnedIds.includes(s.site_id)">
                  #{{ s.rank }} {{ s.site_name }} ({{ s.total_suitability_score }})
                </option>
              }
            </select>
            @if (pinnedIds.length > 0) {
              <button type="button" class="btn btn-sm" (click)="clearAll.emit()">Clear All</button>
            }
          </div>
        </div>

        @if (comparedSites.length === 0) {
          <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.85rem;">
            No sites pinned yet. Use the dropdown above or click "Compare" on any site in the Map or Dashboard.
          </p>
        } @else {
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.85rem;">
            @for (site of comparedSites; track site.site_id) {
              <span class="score-pill" [style.background]="site.color">
                #{{ site.rank }} {{ site.site_name }} ({{ site.total_suitability_score }})
                <button
                  type="button"
                  style="background: transparent; border: none; color: #fff; cursor: pointer; font-weight: 800;"
                  (click)="removePin.emit(site.site_id)"
                >
                  ×
                </button>
              </span>
            }
          </div>

          <div class="charts-grid">
            <div class="panel-card" style="box-shadow: none;">
              <h3 class="panel-title" style="margin-bottom: 0.5rem;">Suitability Profile Overlay</h3>
              <div class="chart-box">
                <canvas #radarCanvas></canvas>
              </div>
            </div>

            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    @for (site of comparedSites; track site.site_id) {
                      <th>{{ site.site_name }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Suitability Score</strong></td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>
                        <span class="score-pill" [style.background]="site.color">
                          {{ site.total_suitability_score }}
                        </span>
                      </td>
                    }
                  </tr>
                  <tr>
                    <td>Global Rank</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>#{{ site.rank }}</td>
                    }
                  </tr>
                  <tr>
                    <td>Land Type</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>{{ site.land_type }}</td>
                    }
                  </tr>
                  <tr>
                    <td>Est. Capacity</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>{{ site.estimated_capacity_mw }} MW</td>
                    }
                  </tr>
                  <tr>
                    <td>Area</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>{{ site.area_sqm | number }} m²</td>
                    }
                  </tr>
                  <tr>
                    <td>Solar Irradiance</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>{{ site.solar_irradiance_kwh }} kWh/m²/d</td>
                    }
                  </tr>
                  <tr>
                    <td>Grid Distance</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>{{ site.grid_distance_km }} km</td>
                    }
                  </tr>
                  <tr>
                    <td>Terrain Slope</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>{{ site.slope_degrees }}°</td>
                    }
                  </tr>
                  <tr>
                    <td>Road Distance</td>
                    @for (site of comparedSites; track site.site_id) {
                      <td>{{ site.road_distance_km }} km</td>
                    }
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        }
      </section>
    </div>
  `,
})
export class SiteCompareComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('radarCanvas') radarCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() allSites: SolarSite[] = [];
  @Input() pinnedIds: number[] = [];

  @Output() addPin = new EventEmitter<number>();
  @Output() removePin = new EventEmitter<number>();
  @Output() clearAll = new EventEmitter<void>();

  addCandidateId: number | null = null;
  private radarChart: Chart | null = null;

  get comparedSites(): SolarSite[] {
    return this.pinnedIds
      .map((id) => this.allSites.find((s) => s.site_id === id))
      .filter((s): s is SolarSite => Boolean(s));
  }

  ngAfterViewInit(): void {
    this.renderRadar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pinnedIds'] || changes['allSites']) {
      setTimeout(() => this.renderRadar(), 0);
    }
  }

  ngOnDestroy(): void {
    this.radarChart?.destroy();
  }

  addSelectedSite(siteId: number | null): void {
    if (siteId !== null) {
      this.addPin.emit(siteId);
      this.addCandidateId = null;
    }
  }

  private renderRadar(): void {
    this.radarChart?.destroy();
    this.radarChart = null;
    if (!this.radarCanvas || this.comparedSites.length === 0) {
      return;
    }

    const palette = [
      { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
      { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.2)' },
      { border: '#16a34a', bg: 'rgba(22, 163, 74, 0.2)' },
    ];

    this.radarChart = new Chart(this.radarCanvas.nativeElement, {
      type: 'radar',
      data: {
        labels: ['Solar', 'Area', 'Grid Proximity', 'Flatness (Slope)', 'Road Access'],
        datasets: this.comparedSites.map((site, idx) => ({
          label: site.site_name,
          data: [
            site.solar_irradiance_score,
            site.area_score,
            site.grid_distance_score,
            site.slope_score,
            site.infrastructure_score,
          ],
          borderColor: palette[idx % palette.length].border,
          backgroundColor: palette[idx % palette.length].bg,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: { min: 0, max: 100 },
        },
      },
    });
  }
}
