import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '../models/solar-site.model';

const ACCESS_KEY = 'solar_access_token';
const REFRESH_KEY = 'solar_refresh_token';
const USER_KEY = 'solar_auth_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly _accessToken = signal<string | null>(this.readStorage(ACCESS_KEY));
  private readonly _user = signal<AuthUser | null>(this.readUserStorage());

  readonly accessToken = this._accessToken.asReadonly();
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this._accessToken()));

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/login/`, payload)
      .pipe(tap((res) => this.persistSession(res)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/register/`, payload)
      .pipe(tap((res) => this.persistSession(res)));
  }

  loadProfile(): Observable<AuthUser> {
    return this.http
      .get<AuthUser>(`${this.baseUrl}/auth/me/`)
      .pipe(tap((user) => this.updateStoredUser(user)));
  }

  logout(): void {
    this._accessToken.set(null);
    this._user.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  private persistSession(res: AuthResponse): void {
    this._accessToken.set(res.access);
    this._user.set(res.user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCESS_KEY, res.access);
      localStorage.setItem(REFRESH_KEY, res.refresh);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    }
  }

  private updateStoredUser(user: AuthUser): void {
    this._user.set(user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  private readStorage(key: string): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  }

  private readUserStorage(): AuthUser | null {
    const raw = this.readStorage(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
