import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoginPayload } from '../../models/solar-site.model';

@Component({
  selector: 'app-auth-screen',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <video
        class="auth-bg-video"
        autoplay
        muted
        loop
        playsinline
        poster="datasee-hero-poster.png"
      >
        <source
          src="https://datasee-ai-public-assets.s3.ap-south-1.amazonaws.com/datasee_website/videos/hero.mp4"
          type="video/mp4"
        />
      </video>
      <div class="auth-bg-scrim"></div>

      <div class="auth-layout">
        <section class="auth-hero">
          <img src="datasee-logo-white.svg" alt="Datasee.AI" class="auth-hero-logo" />
          <h1 class="auth-hero-title">
            <span class="auth-hero-accent">Connecting Data</span><br />
            Empowering Decisions
          </h1>
          <p class="auth-hero-tagline">Acquire &bull; Decipher &bull; Deliver</p>
          <p class="auth-hero-desc">
            Solar Panel Site Analyzer turns aerial, satellite, and terrain intelligence into
            decision-ready suitability analytics for utility-scale solar development.
          </p>
        </section>

        <section class="auth-card" aria-label="Login Screen">
          <div class="auth-card-accent-bar"></div>

          <div class="auth-card-brand">
            <img src="datasee-logo-white.svg" alt="Datasee.AI" class="auth-card-logo" />
            <span class="auth-card-app-badge">Solar Site Analyzer</span>
          </div>

          <h2 class="auth-card-heading">Sign In</h2>
          <p class="auth-card-sub">
            Access interactive GIS screening, suitability scoring &amp; site analytics.
          </p>

          @if (errorMessage) {
            <div class="auth-error-box" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{{ errorMessage }}</span>
            </div>
          }

          <form (ngSubmit)="submit()" #authForm="ngForm" class="auth-form">
            <div class="auth-field">
              <label for="auth-username">Username</label>
              <div class="auth-input-wrap">
                <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="auth-username"
                  name="username"
                  type="text"
                  class="auth-input"
                  required
                  autocomplete="username"
                  placeholder="Enter username"
                  [(ngModel)]="username"
                />
              </div>
            </div>

            <div class="auth-field">
              <label for="auth-password">Password</label>
              <div class="auth-input-wrap">
                <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="auth-password"
                  name="password"
                  [type]="showPassword ? 'text' : 'password'"
                  class="auth-input auth-input-pwd"
                  required
                  autocomplete="current-password"
                  placeholder="Enter password"
                  [(ngModel)]="password"
                />
                <button
                  type="button"
                  class="auth-eye-btn"
                  (click)="showPassword = !showPassword"
                  [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                >
                  @if (showPassword) {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-datasee auth-submit-btn"
              [disabled]="authForm.invalid || busy"
            >
              <span>{{ busy ? 'Signing in...' : 'Sign In' }}</span>
              @if (!busy) {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width: 16px; height: 16px;">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              }
            </button>
          </form>

          <p class="auth-card-footer">
            Secured with JWT &bull; Datasee.AI Geospatial Platform
          </p>
        </section>
      </div>
    </div>
  `,
})
export class AuthScreenComponent {
  @Input() busy = false;
  @Input() errorMessage = '';

  @Output() loginSubmit = new EventEmitter<LoginPayload>();

  username = '';
  password = '';
  showPassword = false;

  submit(): void {
    this.loginSubmit.emit({
      username: this.username.trim(),
      password: this.password,
    });
  }
}
