# Capability

A skills and competency management app. It gives a company a living, structured
picture of what skills its people have, where the gaps are against what each
role actually needs, and how the org is structured — including open (vacant)
positions.

See `docs/CLAUDE.md` for the full project brief (data model, permission rules,
API design, screen specs) this was built against.

## Architecture

Django REST Framework backend (`backend/`) with the data model split across six
apps — `orgstructure` (Role templates and Position org-chart nodes),
`people` (Employee records and the Profile permission tier), `skills` (the
taxonomy, proficiency scales, self/manager ratings, and position requirements),
`certifications`, `learning`, and `staffing` — talking to a React + TypeScript
(Vite, Tailwind, React Router) frontend over a plain JSON API with Django
session auth. The two are built and deployed as a **single Railway service**:
the frontend compiles to static assets that Django serves alongside its API
(via WhiteNoise), so there's one process, one URL, and no CORS to configure —
session cookies work cleanly because everything shares an origin. Locally the
two run as separate dev servers (Vite proxies `/api` to Django) for fast
reloads; only the production build combines them into one deployable image.

## Local setup

### Backend

```
cd backend
python -m venv ../.venv        # or use the venv already in the repo
../.venv/Scripts/activate       # Windows; source ../.venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # defaults work as-is for local dev
python manage.py migrate
python manage.py seed_demo_data # optional — demo org, skills, and users; safe to run once on a fresh DB
python manage.py runserver
```

The seed command's logins all use the password `demopass123`. Notable ones:
`harper` (HR Admin, also a Django superuser — use for `/admin/`), `priya`
(Manager, top of the Engineering tree), `reese` (Executive), `casey` (plain
Employee).

### Frontend

```
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. The dev server proxies `/api/*` to
`http://localhost:8000`, so run the backend on its default port alongside it.

### Tests

```
cd backend && python manage.py test
cd frontend && npm test
```

## Deploying to Railway

The repo ships a multi-stage `Dockerfile` at the root (Node stage builds the
frontend, Python stage serves everything via gunicorn) plus a `railway.json`
pointing Railway at it — no other configuration is required for the build/run
commands themselves.

1. Push this repo to GitHub and create a new Railway project from it (or `railway up` from the CLI).
2. Add a **Postgres** plugin to the service. Railway injects `DATABASE_URL`
   automatically; the backend picks it up via `dj-database-url` and switches
   off SQLite (which is local-dev-only — Railway's filesystem is ephemeral,
   so SQLite data would be lost on every redeploy).
3. Set these service environment variables:
   - `SECRET_KEY` — any long random string.
   - `DEBUG` — leave unset or `False`.
   - `CSRF_TRUSTED_ORIGINS` — your Railway-assigned domain, e.g. `https://your-app.up.railway.app` (comma-separate if you add a custom domain later).
   - `ALLOWED_HOSTS` — set this explicitly to your Railway domain, e.g. `capability-production.up.railway.app` (comma-separate if you add a custom domain later). The app also auto-adds Railway's `RAILWAY_PUBLIC_DOMAIN` if present, but that variable isn't reliably available at boot if the container started before the domain was generated — set `ALLOWED_HOSTS` directly rather than relying on it.
4. After the first deploy, run migrations and (optionally) the seed command
   from a Railway shell against the service: `python manage.py migrate`,
   `python manage.py seed_demo_data`, `python manage.py createsuperuser`.

## Known limitations / deliberately out of scope

Per the brief (`docs/CLAUDE.md`, Section 2 and Section 9), this MVP
intentionally does not include: Docker/Postgres in local dev (SQLite is the
zero-config default; Postgres is production-only, wired via `DATABASE_URL`),
Celery or any background job runner, real SSO/OIDC (session auth + a
`Profile.role` field stands in for it), HRIS/LMS integrations, or a design
system library beyond Tailwind utility classes. `SkillRating` keeps only the
current rating per employee/skill — no history table. `Assignment`
(staffing/projects) is modelled and exposed via CRUD but isn't wired into any
report yet (Section 7 doesn't ask for seed data for it, and Section 5's
Capability Search searches ratings directly rather than through it). The
Capability Search screen's "availability" filter mentioned in Section 6 was
skipped — there's no data source for it in this model.

Two small gaps were found and closed while implementing, beyond what
Section 4/5 specify exactly:
- `EmployeeCertification` write access (Section 3 doesn't grant HR Admin CRUD
  on it explicitly, only on the `Certification` catalog) defaults to HR Admin
  full CRUD / Employee read-own, matching the "HR Admin (all)" audience in the
  Certifications Tracker screen (Section 6, #9).
- `GET /api/dashboard-summary/` (Executive/HR Admin only) was added — it's not
  one of the 5 endpoints Section 5 enumerates, but the Org Capability
  Dashboard screen (Section 6, #10) needs vacancy/bench/certification-compliance
  data that no listed endpoint exposes to Executives, since every standard
  model viewset is off-limits to that role.

All ten screens from Section 6 are implemented as a working slice, not just
the first six the brief says are acceptable to ship alone.
