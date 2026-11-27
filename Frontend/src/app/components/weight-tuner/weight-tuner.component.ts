import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WeightConfig } from '../../models/solar-site.model';

interface WeightFactorMeta {
  key: keyof WeightConfig;
  label: string;
}

@Component({
  selector: 'app-weight-tuner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="panel-card" aria-label="Suitability Weight Tuner">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Analysis Weight Tuner</h2>
          <p class="panel-subtitle">Adjust criteria weights &amp; recalculate</p>
        </div>
        <span
          class="score-pill"
          [style.background]="isSumValid ? '#16a34a' : '#dc2626'"
        >
          {{ totalPercent | number: '1.0-0' }}%
        </span>
      </div>

      @for (factor of factors; track factor.key) {
        <div class="field-group">
          <label [for]="'w-' + factor.key">
            <span>{{ factor.label }}</span>
            <strong>{{ draftPercent[factor.key] }}%</strong>
          </label>
          <input
            [id]="'w-' + factor.key"
            type="range"
            class="range-slider"
            min="0"
            max="100"
            step="5"
            [(ngModel)]="draftPercent[factor.key]"
          />
        </div>
      }

      @if (!isSumValid) {
        <p style="margin: 0 0 0.65rem; font-size: 0.76rem; color: #dc2626; font-weight: 600;">
          Weights must total 100% (currently {{ totalPercent }}%).
        </p>
      }

      <div style="display: flex; flex-wrap: wrap; gap: 0.45rem;">
        <button
          type="button"
          class="btn btn-solar btn-sm"
          style="flex: 1;"
          [disabled]="!isSumValid || busy"
          (click)="emitRecalculate(true)"
        >
          {{ busy ? 'Scoring...' : 'Apply & Save' }}
        </button>
        <button
          type="button"
          class="btn btn-sm"
          [disabled]="!isSumValid || busy"
          (click)="emitRecalculate(false)"
        >
          Preview
        </button>
      </div>

      <div style="display: flex; gap: 0.45rem; margin-top: 0.45rem;">
        <button type="button" class="btn btn-sm" style="flex: 1;" (click)="normalizeTo100()">
          Auto-Balance 100%
        </button>
        <button type="button" class="btn btn-sm" style="flex: 1;" (click)="resetDefaults()">
          Defaults
        </button>
      </div>
    </section>
  `,
})
export class WeightTunerComponent implements OnChanges {
  @Input() weights: WeightConfig = {
    solar: 0.35,
    area: 0.25,
    grid: 0.2,
    slope: 0.15,
    infrastructure: 0.05,
  };
  @Input() busy = false;

  @Output() recalculate = new EventEmitter<{ weights: WeightConfig; persist: boolean }>();

  readonly factors: WeightFactorMeta[] = [
    { key: 'solar', label: 'Solar Irradiance' },
    { key: 'area', label: 'Available Land Area' },
    { key: 'grid', label: 'Power Grid Proximity' },
    { key: 'slope', label: 'Terrain Slope' },
    { key: 'infrastructure', label: 'Road / Infrastructure' },
  ];

  draftPercent: Record<keyof WeightConfig, number> = {
    solar: 35,
    area: 25,
    grid: 20,
    slope: 15,
    infrastructure: 5,
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['weights'] && this.weights) {
      this.draftPercent = {
        solar: Math.round(this.weights.solar * 100),
        area: Math.round(this.weights.area * 100),
        grid: Math.round(this.weights.grid * 100),
        slope: Math.round(this.weights.slope * 100),
        infrastructure: Math.round(this.weights.infrastructure * 100),
      };
    }
  }

  get totalPercent(): number {
    return (
      this.draftPercent.solar +
      this.draftPercent.area +
      this.draftPercent.grid +
      this.draftPercent.slope +
      this.draftPercent.infrastructure
    );
  }

  get isSumValid(): boolean {
    return this.totalPercent === 100;
  }

  normalizeTo100(): void {
    const sum = this.totalPercent;
    if (sum === 0) {
      this.resetDefaults();
      return;
    }
    const keys = this.factors.map((f) => f.key);
    const scaled = keys.map((k) => Math.round((this.draftPercent[k] / sum) * 100));
    const diff = 100 - scaled.reduce((a, b) => a + b, 0);
    scaled[0] += diff;
    keys.forEach((k, idx) => {
      this.draftPercent[k] = Math.max(0, scaled[idx]);
    });
  }

  resetDefaults(): void {
    this.draftPercent = {
      solar: 35,
      area: 25,
      grid: 20,
      slope: 15,
      infrastructure: 5,
    };
  }

  emitRecalculate(persist: boolean): void {
    if (!this.isSumValid) {
      return;
    }
    this.recalculate.emit({
      persist,
      weights: {
        solar: Number((this.draftPercent.solar / 100).toFixed(2)),
        area: Number((this.draftPercent.area / 100).toFixed(2)),
        grid: Number((this.draftPercent.grid / 100).toFixed(2)),
        slope: Number((this.draftPercent.slope / 100).toFixed(2)),
        infrastructure: Number((this.draftPercent.infrastructure / 100).toFixed(2)),
      },
    });
  }
}
