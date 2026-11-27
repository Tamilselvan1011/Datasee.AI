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
import { SolarSite, StatisticsResponse } from '../../models/solar-site.model';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (stats) {
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <section class="kpi-grid" aria-label="Key Performance Indicators">
          <div class="kpi-card">
            <div class="kpi-label">Sites Analyzed</div>
            <div class="kpi-value">{{ stats.total_sites }}</div>
            <div class="kpi-sub">Total area {{ stats.total_area_sqm | number }} m²</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Average Suitability</div>
            <div class="kpi-value">{{ stats.avg_score }}</div>
            <div class="kpi-sub">Std Dev {{ stats.std_dev }} &bull; Min {{ stats.min_score }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Top Site Score</div>
            <div class="kpi-value">{{ stats.max_score }}</div>
            <div class="kpi-sub">Out of 100 weighted index</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Solar Potential</div>
            <div class="kpi-value">{{ stats.total_potential_mw }} MW</div>
            <div class="kpi-sub">Estimated utility-scale capacity</div>
          </div>
        </section>

        <section class="charts-grid">
          <div class="panel-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Suitability Score Distribution</h2>
                <p class="panel-subtitle">Site count by classification tier</p>
              </div>
            </div>
            <div class="chart-box">
              <canvas #distCanvas></canvas>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Average Score by Land Type</h2>
                <p class="panel-subtitle">Comparing terrain suitability across categories</p>
              </div>
            </div>
            <div class="chart-box">
              <canvas #landCanvas></canvas>
            </div>
          </div>
        </section>

        <section class="panel-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Top 10 Recommended Sites</h2>
              <p class="panel-subtitle">Ranked by current weighted suitability score</p>
            </div>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Site Name</th>
                  <th>Land Type</th>
                  <th>Solar (kWh)</th>
                  <th>Area (MW)</th>
                  <th>Grid (km)</th>
                  <th>Slope (°)</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (site of stats.top_10_sites; track site.site_id) {
                  <tr>
                    <td><strong>#{{ site.rank }}</strong></td>
                    <td><strong>{{ site.site_name }}</strong></td>
                    <td>{{ site.land_type }}</td>
                    <td>{{ site.solar_irradiance_kwh }}</td>
                    <td>{{ site.area_sqm | number }} m² ({{ site.estimated_capacity_mw }} MW)</td>
                    <td>{{ site.grid_distance_km }}</td>
                    <td>{{ site.slope_degrees }}°</td>
                    <td>
                      <span class="score-pill" [style.background]="site.color">
                        {{ site.total_suitability_score }}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem;">
                        <button type="button" class="btn btn-sm" (click)="inspectSite.emit(site)">
                          Details
                        </button>
                        <button type="button" class="btn btn-sm" (click)="editSite.emit(site)">
                          Edit
                        </button>
                        <button type="button" class="btn btn-sm btn-solar" (click)="locateSite.emit(site)">
                          Map
                        </button>
                        <button type="button" class="btn btn-sm" (click)="togglePin.emit(site.site_id)">
                          {{ pinnedIds.includes(site.site_id) ? 'Pinned' : 'Compare' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    } @else {
      <div class="panel-card">Loading analytics summary...</div>
    }
  `,
})
export class AnalyticsDashboardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('distCanvas') distCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('landCanvas') landCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() stats: StatisticsResponse | null = null;
  @Input() pinnedIds: number[] = [];

  @Output() inspectSite = new EventEmitter<SolarSite>();
  @Output() editSite = new EventEmitter<SolarSite>();
  @Output() locateSite = new EventEmitter<SolarSite>();
  @Output() togglePin = new EventEmitter<number>();

  private distChart: Chart | null = null;
  private landChart: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stats']) {
      setTimeout(() => this.renderCharts(), 0);
    }
  }

  ngOnDestroy(): void {
    this.distChart?.destroy();
    this.landChart?.destroy();
  }

  private renderCharts(): void {
    this.distChart?.destroy();
    this.landChart?.destroy();
    this.distChart = null;
    this.landChart = null;

    if (!this.stats) {
      return;
    }

    if (this.distCanvas) {
      this.distChart = new Chart(this.distCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: this.stats.score_distribution.map((b) => b.label),
          datasets: [
            {
              label: 'Sites',
              data: this.stats.score_distribution.map((b) => b.count),
              backgroundColor: this.stats.score_distribution.map((b) => b.color),
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    }

    if (this.landCanvas) {
      this.landChart = new Chart(this.landCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: this.stats.by_land_type.map((l) => `${l.land_type} (${l.site_count})`),
          datasets: [
            {
              label: 'Average Suitability Score',
              data: this.stats.by_land_type.map((l) => l.avg_score),
              backgroundColor: '#0ea5e9',
              borderRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { min: 0, max: 100 } },
        },
      });
    }
  }
}
