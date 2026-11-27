# Solar Panel Site Analyzer — Frontend (`DATASEE.AI`)

Angular 22 Single-Page Application for interactive geospatial solar site screening, suitability weight tuning, polygon zone analysis, comparison, analytics charting, site CRUD, and CSV preview import.

---

## Live Deployment & Demo Credentials

- **Live App:** https://dataseeai-production.up.railway.app/
- **Django Admin:** https://dataseeai-production.up.railway.app/admin/
- **Username:** `admin`
- **Password:** `12345`

---

## Implemented UI & Components

| Component / Module | Path | Responsibility |
| :--- | :--- | :--- |
| **Auth Screen** | `src/app/components/auth-screen/auth-screen.component.ts` | Full-screen video-backed (`hero.mp4` + `datasee-hero-poster.png`) JWT login-only experience with password toggle |
| **Auth Service & Interceptor** | `src/app/services/auth.service.ts`, `src/app/interceptors/auth.interceptor.ts` | JWT token storage, automatic `Bearer` header attachment, and token refresh handling |
| **Navbar** | `src/app/components/navbar/navbar.component.ts` | Single-row desktop navigation (`Map Explorer`, `Analytics Dashboard`, `Compare`, `+ Add Site`), right-aligned **Upload / Export** dropdown, user status/logout, plus mobile bottom nav & Tools sheet |
| **Solar Map** | `src/app/components/solar-map/solar-map.component.ts` | Leaflet 1.9.4 map using Esri World Street, Imagery, and Topographic layers, capacity-scaled suitability markers, and click-to-draw polygon analysis |
| **Filter Sidebar** | `src/app/components/filter-sidebar/filter-sidebar.component.ts` | Live search, min score slider, land type & region filters, and sort controls |
| **Weight Tuner** | `src/app/components/weight-tuner/weight-tuner.component.ts` | Adjust scoring factor weights (validated to `100%`), preview recalculations, and persist weights |
| **Site Detail Drawer** | `src/app/components/site-detail-drawer/site-detail-drawer.component.ts` | Inspect factor scores, capacity, annual MWh, CO₂ offset, compare toggle, and **Edit** / **Delete** triggers |
| **Analytics Dashboard** | `src/app/components/analytics-dashboard/analytics-dashboard.component.ts` | Chart.js KPI visualizations, category distributions, regional breakdowns, and top-site rankings |
| **Site Compare** | `src/app/components/site-compare/site-compare.component.ts` | Side-by-side comparison across selected candidate sites |
| **Add / Edit Site Form** | `src/app/components/site-form/site-form.component.ts` | Create, edit, validate, and delete solar sites directly in the web workspace |
| **CSV Upload Modal** | `src/app/components/csv-upload-modal/csv-upload-modal.component.ts` | Upload `.csv` datasets, download `sample_solar_sites.csv`, review dry-run validation preview rows, and confirm import |

---

## Environment & Static Assets

- **Development API (`src/environments/environment.ts`):** Points to `http://localhost:8000/api`.
- **Production API (`src/environments/environment.prod.ts`):** Uses relative `/api` (served alongside Django via WhiteNoise in the root `Dockerfile` build).
- **Public Assets (`public/`):**
  - `favicon.ico` — Datasee.AI favicon
  - `og-share.jpg` — `1200x630` Open Graph / WhatsApp link preview image
  - `hero.mp4` & `datasee-hero-poster.png` — Login background video and fallback poster
  - `datasee-logo-white.svg` & `datasee-logo-black.svg` — Brand logos
  - `sample_solar_sites.csv` — Downloadable CSV upload template

---

## Development & Verification Commands

Run all commands from `D:\Assessment\Frontend`:

```bash
# Install dependencies
npm install

# Start local Angular dev server (http://localhost:4200/)
npm start

# Production build (replaces environment.ts with environment.prod.ts -> /api)
npm run build

# Run Vitest unit tests (src/app/app.spec.ts)
npx ng test --watch=false
```
