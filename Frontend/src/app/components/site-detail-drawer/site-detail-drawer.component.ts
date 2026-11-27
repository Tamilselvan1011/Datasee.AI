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
import Chart from 'chart.js/auto';
import { SolarSite } from '../../models/solar-site.model';

@Component({
  selector: 'app-site-detail-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (site) {
      <div class="drawer-backdrop" (click)="close.emit()">
        <aside class="detail-drawer" (click)="$event.stopPropagation()" aria-label="Site Details">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                <span class="score-pill" [style.background]="site.color">
                  {{ site.total_suitability_score }} / 100 &bull; {{ site.category }}
                </span>
                <span style="font-size: 0.78rem; font-weight: 700; color: #475569;">
                  Rank #{{ site.rank }}{{ site.total_sites_ranked ? ' of ' + site.total_sites_ranked : '' }}
                </span>
              </div>
              <h2 style="margin: 0.45rem 0 0.15rem; font-size: 1.15rem;">{{ site.site_name }}</h2>
              <p style="margin: 0; font-size: 0.8rem; color: #64748b;">
                {{ site.land_type }} &bull; {{ site.region }} &bull; ({{ site.latitude }}, {{ site.longitude }})
              </p>
            </div>
            <button type="button" class="btn btn-sm" (click)="close.emit()">Close</button>
          </div>

          <p style="margin: 0; font-size: 0.82rem; color: #334155; background: #f8fafc; padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong>Recommendation:</strong> {{ site.recommendation }}
          </p>

          <div class="detail-action-row">
            <button type="button" class="btn btn-solar btn-sm" (click)="locateOnMap.emit(site)">
              Locate on Map
            </button>
            <button type="button" class="btn btn-primary btn-sm" (click)="editSite.emit(site)">
              Edit Site
            </button>
            <button type="button" class="btn btn-sm" (click)="togglePin.emit(site.site_id)">
              {{ isPinned ? 'Unpin' : 'Compare' }}
            </button>
          </div>

          <div>
            <h3 class="panel-title" style="margin-bottom: 0.45rem;">Pre-Construction Risk Flags</h3>
            @if (riskFlags.length === 0) {
              <span class="risk-badge risk-ok">Low Pre-Construction Risk (All Thresholds Optimal)</span>
            } @else {
              @for (flag of riskFlags; track flag) {
                <span class="risk-badge risk-warn">{{ flag }}</span>
              }
            }
          </div>

          <div>
            <h3 class="panel-title" style="margin-bottom: 0.45rem;">Engineering &amp; Spatial Metrics</h3>
            <div class="detail-metrics-grid">
              <div class="kpi-card" style="padding: 0.6rem;">
                <div class="kpi-label">Est. Capacity</div>
                <div style="font-weight: 800; font-size: 1.05rem;">{{ site.estimated_capacity_mw }} MW</div>
              </div>
              <div class="kpi-card" style="padding: 0.6rem;">
                <div class="kpi-label">Land Area</div>
                <div style="font-weight: 800; font-size: 1.05rem;">
                  {{ site.area_sqm | number }} m²
                  <span style="font-weight: 500; font-size: 0.74rem; color: #64748b;">({{ site.area_acres }} ac)</span>
                </div>
              </div>
              <div class="kpi-card" style="padding: 0.6rem;">
                <div class="kpi-label">Solar Irradiance</div>
                <div style="font-weight: 800; font-size: 1.05rem;">{{ site.solar_irradiance_kwh }} kWh/m²/d</div>
              </div>
              <div class="kpi-card" style="padding: 0.6rem;">
                <div class="kpi-label">Grid Distance</div>
                <div style="font-weight: 800; font-size: 1.05rem;">{{ site.grid_distance_km }} km</div>
              </div>
              <div class="kpi-card" style="padding: 0.6rem;">
                <div class="kpi-label">Terrain Slope</div>
                <div style="font-weight: 800; font-size: 1.05rem;">{{ site.slope_degrees }}°</div>
              </div>
              <div class="kpi-card" style="padding: 0.6rem;">
                <div class="kpi-label">Road / Elevation</div>
                <div style="font-weight: 800; font-size: 1.05rem;">{{ site.road_distance_km }} km &bull; {{ site.elevation_m }} m</div>
              </div>
            </div>
          </div>

          <div>
            <h3 class="panel-title" style="margin-bottom: 0.45rem;">Factor Score Breakdown (0–100)</h3>
            <div style="height: 220px; position: relative;">
              <canvas #breakdownCanvas></canvas>
            </div>
          </div>
        </aside>
      </div>
    }
  `,
})
export class SiteDetailDrawerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('breakdownCanvas') breakdownCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() site: SolarSite | null = null;
  @Input() isPinned = false;

  @Output() close = new EventEmitter<void>();
  @Output() locateOnMap = new EventEmitter<SolarSite>();
  @Output() editSite = new EventEmitter<SolarSite>();
  @Output() togglePin = new EventEmitter<number>();

  private chart: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['site']) {
      setTimeout(() => this.renderChart(), 0);
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  get riskFlags(): string[] {
    if (!this.site) {
      return [];
    }
    const flags: string[] = [];
    if (this.site.slope_degrees > 10) {
      flags.push(`Terrain Grading Risk: ${this.site.slope_degrees}° slope`);
    }
    if (this.site.grid_distance_km > 5) {
      flags.push(`High Grid Tie-in Cost: ${this.site.grid_distance_km} km`);
    }
    if (this.site.road_distance_km > 2) {
      flags.push(`Access Road Required: ${this.site.road_distance_km} km`);
    }
    if (this.site.solar_irradiance_kwh < 4.5) {
      flags.push(`Moderate Solar Resource: ${this.site.solar_irradiance_kwh} kWh/m²/d`);
    }
    return flags;
  }

  private renderChart(): void {
    this.chart?.destroy();
    this.chart = null;
    if (!this.site || !this.breakdownCanvas) {
      return;
    }

    const dataValues = [
      this.site.solar_irradiance_score,
      this.site.area_score,
      this.site.grid_distance_score,
      this.site.slope_score,
      this.site.infrastructure_score,
    ];

    this.chart = new Chart(this.breakdownCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Solar Irradiance', 'Land Area', 'Grid Proximity', 'Terrain Slope', 'Infrastructure'],
        datasets: [
          {
            label: 'Sub-score (0-100)',
            data: dataValues,
            backgroundColor: ['#f59e0b', '#0ea5e9', '#16a34a', '#8b5cf6', '#64748b'],
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { min: 0, max: 100 },
        },
      },
    });
  }
}
