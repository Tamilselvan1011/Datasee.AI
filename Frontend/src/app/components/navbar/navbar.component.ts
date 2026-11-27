import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AuthUser, HealthResponse } from '../../models/solar-site.model';

export type AppViewTab = 'map' | 'dashboard' | 'compare' | 'manage';

@Component({
  selector: 'app-navbar',
  standalone: true,
  template: `
    <header class="top-navbar">
      <div class="brand-block">
        <img src="datasee-logo-white.svg" alt="Datasee.AI" class="brand-logo-img" />
        <div class="brand-divider"></div>
        <div class="brand-text">
          <h1 class="brand-title">Solar Panel Site Analyzer</h1>
          <p class="brand-subtitle">Geospatial Pre-Construction Intelligence</p>
        </div>
      </div>

      <nav class="nav-tabs" aria-label="Primary Workspace Views">
        <button
          type="button"
          class="nav-tab"
          [class.active]="activeTab === 'map'"
          (click)="selectTab('map')"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <span class="nav-label-desktop">Map Explorer</span>
          <span class="nav-label-mobile">Map</span>
        </button>

        <button
          type="button"
          class="nav-tab"
          [class.active]="activeTab === 'dashboard'"
          (click)="selectTab('dashboard')"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span class="nav-label-desktop">Analytics Dashboard</span>
          <span class="nav-label-mobile">Stats</span>
        </button>

        <button
          type="button"
          class="nav-tab"
          [class.active]="activeTab === 'compare'"
          (click)="selectTab('compare')"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
          </svg>
          <span class="nav-label-desktop">Compare ({{ pinnedCount }})</span>
          <span class="nav-label-mobile">Compare ({{ pinnedCount }})</span>
        </button>

        <button
          type="button"
          class="nav-tab"
          [class.active]="activeTab === 'manage'"
          (click)="selectTab('manage')"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span class="nav-label-desktop">{{ isEditing ? 'Edit Site' : '+ Add Site' }}</span>
          <span class="nav-label-mobile">{{ isEditing ? 'Edit' : 'Add Site' }}</span>
        </button>
      </nav>

      <!-- Desktop inline actions -->
      <div class="nav-actions desktop-actions">
        <span class="health-pill" title="Backend API & MySQL status">
          <span class="health-dot" [class.offline]="!health || health.status !== 'ok'"></span>
          @if (health && health.status === 'ok') {
            API Online &bull; {{ health.sites_count }} sites
          } @else {
            API Offline
          }
        </span>
        <button type="button" class="btn btn-ghost-dark btn-sm" (click)="openUpload.emit()">
          Upload CSV
        </button>
        <button type="button" class="btn btn-ghost-dark btn-sm" (click)="exportRequested.emit('csv')">
          Export CSV
        </button>
        <button type="button" class="btn btn-solar btn-sm" (click)="exportRequested.emit('json')">
          Export JSON
        </button>

        @if (currentUser) {
          <span class="health-pill" title="Signed-in user">
            {{ currentUser.username }}
          </span>
          <button type="button" class="btn btn-ghost-dark btn-sm" (click)="logout.emit()">
            Logout
          </button>
        }
      </div>

      <!-- Mobile compact status + Actions menu -->
      <div class="mobile-actions-wrap">
        <span class="health-pill" title="Backend API & MySQL status">
          <span class="health-dot" [class.offline]="!health || health.status !== 'ok'"></span>
          {{ health && health.status === 'ok' ? health.sites_count : 'Off' }}
        </span>
        <button
          type="button"
          class="btn btn-ghost-dark btn-sm"
          (click)="mobileMenuOpen = !mobileMenuOpen"
          aria-label="Toggle data actions menu"
        >
          {{ currentUser ? currentUser.username : 'Tools' }} {{ mobileMenuOpen ? '▲' : '▾' }}
        </button>
      </div>

      @if (mobileMenuOpen) {
        <div class="mobile-tools-drawer">
          <button
            type="button"
            class="btn btn-ghost-dark btn-sm"
            (click)="mobileMenuOpen = false; openUpload.emit()"
          >
            Upload CSV
          </button>
          <button
            type="button"
            class="btn btn-ghost-dark btn-sm"
            (click)="mobileMenuOpen = false; exportRequested.emit('csv')"
          >
            Export CSV
          </button>
          <button
            type="button"
            class="btn btn-solar btn-sm"
            (click)="mobileMenuOpen = false; exportRequested.emit('json')"
          >
            Export JSON
          </button>
          @if (currentUser) {
            <button
              type="button"
              class="btn btn-ghost-dark btn-sm"
              (click)="mobileMenuOpen = false; logout.emit()"
            >
              Logout
            </button>
          }
        </div>
      }
    </header>
  `,
})
export class NavbarComponent {
  @Input() activeTab: AppViewTab = 'map';
  @Input() pinnedCount = 0;
  @Input() isEditing = false;
  @Input() health: HealthResponse | null = null;
  @Input() currentUser: AuthUser | null = null;

  @Output() tabChange = new EventEmitter<AppViewTab>();
  @Output() openUpload = new EventEmitter<void>();
  @Output() exportRequested = new EventEmitter<'csv' | 'json'>();
  @Output() logout = new EventEmitter<void>();

  mobileMenuOpen = false;

  selectTab(tab: AppViewTab): void {
    this.mobileMenuOpen = false;
    this.tabChange.emit(tab);
  }
}
