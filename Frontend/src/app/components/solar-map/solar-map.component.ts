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
import * as L from 'leaflet';
import { PolygonAnalyzeResponse, SolarSite } from '../../models/solar-site.model';

@Component({
  selector: 'app-solar-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-shell">
      <div #mapContainer style="width: 100%; height: 100%;"></div>

      <div class="map-toolbar">
        <button type="button" class="btn btn-sm" (click)="fitToSites()">Fit All Sites</button>
        @if (!drawingMode) {
          <button type="button" class="btn btn-primary btn-sm" (click)="startDrawing()">
            Draw Analysis Zone
          </button>
        } @else {
          <button
            type="button"
            class="btn btn-solar btn-sm"
            [disabled]="drawnVertices.length < 3"
            (click)="finishDrawing()"
          >
            Analyze Zone ({{ drawnVertices.length }} pts)
          </button>
          <button type="button" class="btn btn-sm" (click)="cancelDrawing()">Cancel</button>
        }
        @if (polygonSummary) {
          <button type="button" class="btn btn-sm" (click)="clearPolygonResult()">Clear Zone</button>
        }
      </div>

      @if (drawingMode) {
        <div class="map-draw-hint">
          Click on the map to place polygon vertices (minimum 3 points), then click Analyze Zone.
        </div>
      }

      <div class="map-legend" [class.legend-collapsed]="!legendExpanded">
        <button
          type="button"
          class="legend-toggle-btn"
          (click)="legendExpanded = !legendExpanded"
        >
          <strong>Suitability Tiers</strong>
          <span>{{ legendExpanded ? '▾' : '▸' }}</span>
        </button>
        @if (legendExpanded) {
          <div class="legend-items">
            <div class="legend-row">
              <span class="legend-swatch" style="background: #16a34a;"></span>
              <span>Excellent (80–100)</span>
            </div>
            <div class="legend-row">
              <span class="legend-swatch" style="background: #65a30d;"></span>
              <span>Good (60–79)</span>
            </div>
            <div class="legend-row">
              <span class="legend-swatch" style="background: #eab308;"></span>
              <span>Fair (40–59)</span>
            </div>
            <div class="legend-row">
              <span class="legend-swatch" style="background: #f97316;"></span>
              <span>Poor (20–39)</span>
            </div>
            <div class="legend-row">
              <span class="legend-swatch" style="background: #dc2626;"></span>
              <span>Very Poor (0–19)</span>
            </div>
          </div>
        }
      </div>

      @if (polygonSummary) {
        <div class="zone-summary-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <strong>Custom Zone Analysis</strong>
            <button type="button" class="btn btn-sm btn-ghost-dark" (click)="clearPolygonResult()">
              ×
            </button>
          </div>
          <div>Sites inside boundary: <strong>{{ polygonSummary.matched_count }}</strong></div>
          <div>Average Suitability: <strong>{{ polygonSummary.average_score }}</strong> / 100</div>
          <div>Total Area: <strong>{{ polygonSummary.total_area_sqm | number }} m²</strong></div>
          <div>Est. Solar Potential: <strong>{{ polygonSummary.total_potential_mw }} MW</strong></div>
        </div>
      }
    </div>
  `,
})
export class SolarMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() sites: SolarSite[] = [];
  @Input() selectedSiteId: number | null = null;
  @Input() focusSite: SolarSite | null = null;
  @Input() visible = true;
  @Input() polygonSummary: PolygonAnalyzeResponse | null = null;

  @Output() siteSelected = new EventEmitter<SolarSite>();
  @Output() polygonSubmitted = new EventEmitter<number[][]>();
  @Output() polygonCleared = new EventEmitter<void>();

  private map: L.Map | null = null;
  private markerLayer = L.layerGroup();
  private drawLayer = L.layerGroup();
  private resizeObserver: ResizeObserver | null = null;

  drawingMode = false;
  legendExpanded = typeof window !== 'undefined' ? window.innerWidth > 640 : true;
  drawnVertices: L.LatLng[] = [];

  ngAfterViewInit(): void {
    this.initMap();
    this.renderMarkers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) {
      return;
    }
    if (changes['sites'] || changes['selectedSiteId']) {
      this.renderMarkers();
    }
    if (changes['focusSite'] && this.focusSite) {
      this.map.setView([this.focusSite.latitude, this.focusSite.longitude], 13, {
        animate: true,
      });
    }
    if (changes['visible'] && this.visible) {
      setTimeout(() => this.map?.invalidateSize(), 120);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  private initMap(): void {
    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri',
      },
    );

    const terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap contributors',
    });

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [11.05, 77.15],
      zoom: 9,
      layers: [street],
    });

    L.control
      .layers(
        {
          'Street Map': street,
          'Satellite Imagery': satellite,
          'Topographic Terrain': terrain,
        },
        undefined,
        { position: 'topright' },
      )
      .addTo(this.map);

    this.markerLayer.addTo(this.map);
    this.drawLayer.addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.drawingMode) {
        this.drawnVertices = [...this.drawnVertices, e.latlng];
        this.renderDraftPolygon();
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.map?.invalidateSize();
      });
      this.resizeObserver.observe(this.mapContainer.nativeElement);
    }
  }

  private renderMarkers(): void {
    this.markerLayer.clearLayers();
    if (!this.sites.length) {
      return;
    }

    for (const site of this.sites) {
      const isSelected = site.site_id === this.selectedSiteId;
      const radius = Math.max(6, Math.min(14, 5 + site.estimated_capacity_mw * 0.9));
      const marker = L.circleMarker([site.latitude, site.longitude], {
        radius: isSelected ? radius + 3 : radius,
        fillColor: site.color,
        color: isSelected ? '#0f172a' : '#ffffff',
        weight: isSelected ? 3 : 1.5,
        opacity: 1,
        fillOpacity: 0.88,
      });

      marker.bindTooltip(
        `<strong>${site.site_name}</strong><br/>Score: ${site.total_suitability_score} (${site.category}) &bull; ${site.estimated_capacity_mw} MW`,
        { direction: 'top', offset: [0, -6] },
      );

      marker.on('click', () => {
        if (!this.drawingMode) {
          this.siteSelected.emit(site);
        }
      });

      marker.addTo(this.markerLayer);
    }
  }

  fitToSites(): void {
    if (!this.map || this.sites.length === 0) {
      return;
    }
    const bounds = L.latLngBounds(this.sites.map((s) => [s.latitude, s.longitude] as [number, number]));
    this.map.fitBounds(bounds.pad(0.12));
  }

  startDrawing(): void {
    this.drawingMode = true;
    this.drawnVertices = [];
    this.drawLayer.clearLayers();
    this.polygonCleared.emit();
  }

  cancelDrawing(): void {
    this.drawingMode = false;
    this.drawnVertices = [];
    this.drawLayer.clearLayers();
  }

  finishDrawing(): void {
    if (this.drawnVertices.length < 3) {
      return;
    }
    this.drawingMode = false;
    this.renderDraftPolygon(true);
    const coords = this.drawnVertices.map((v) => [Number(v.lat.toFixed(6)), Number(v.lng.toFixed(6))]);
    this.polygonSubmitted.emit(coords);
  }

  clearPolygonResult(): void {
    this.drawingMode = false;
    this.drawnVertices = [];
    this.drawLayer.clearLayers();
    this.polygonCleared.emit();
  }

  private renderDraftPolygon(closed = false): void {
    this.drawLayer.clearLayers();
    for (const pt of this.drawnVertices) {
      L.circleMarker(pt, {
        radius: 5,
        fillColor: '#f59e0b',
        color: '#0f172a',
        weight: 2,
        fillOpacity: 1,
      }).addTo(this.drawLayer);
    }
    if (this.drawnVertices.length >= 2) {
      if (closed || this.drawnVertices.length >= 3) {
        L.polygon(this.drawnVertices, {
          color: '#f59e0b',
          weight: 2.5,
          fillColor: '#f59e0b',
          fillOpacity: 0.16,
        }).addTo(this.drawLayer);
      } else {
        L.polyline(this.drawnVertices, {
          color: '#f59e0b',
          weight: 2.5,
          dashArray: '5, 5',
        }).addTo(this.drawLayer);
      }
    }
  }
}
