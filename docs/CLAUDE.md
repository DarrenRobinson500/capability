# Human Capability Management App — Project Brief for Claude Code

## How to use this file

1. Create a new empty folder for the project and `cd` into it.
2. Save this file as `CLAUDE.md` in that folder.
3. Run `claude` to start a session, then say: **"Read CLAUDE.md and start with Phase 0."**
4. Work through the phases in order (Section 8). Commit after each phase.
5. If something isn't covered here and affects the data model, permissions, or API shape, ask before guessing. Cosmetic/styling decisions are fine to make unilaterally.

This brief is a full spec, not just a prompt — everything Claude Code needs to build the MVP without re-deriving it from scratch is below.

---

## 1. What this is

A skills and competency management app. It gives a company a living, structured picture of what skills its people have, where the gaps are against what each role actually needs, and how the org is structured — including open (vacant) positions.

Core design decisions already made (don't relitigate these):

- **Role vs. Position are separate entities.** `Role` is a reusable job template (title, level, career-ladder baseline). `Position` is an actual node in the org chart — it points to one `Role`, has a `parent_position` (reporting line), and optionally an assigned employee. A `Position` with no employee is a vacancy.
- **There is no `manager_id` on Employee.** A person's manager is derived by walking `Position → parent_position → that Position's employee`. Do not add a stored manager field — this was a deliberate choice to avoid data drift.
- **Skill requirements live on `Position`, not `Role`.** A Role template can be reused by many Positions across different teams, so each Position's manager sets its own required skills and minimum proficiency, pulling only from the HR-owned skill menu.
- **Employees can self-assess any skill in the taxonomy**, not just the ones their current Position requires — this is what makes capability search useful for internal mobility, not just gap-closing.
- **HR owns the skill taxonomy, Role templates, and Position/org structure.** Managers own Position requirements for positions on their team and endorse their team's self-assessments. Executives get read-only dashboards.

## 2. Tech stack

- **Backend:** Django 5.x + Django REST Framework. SQLite for local dev (no Postgres/Docker for this phase). Django's built-in session auth + a `Profile.role` field for MVP — no SSO/OIDC yet.
- **Frontend:** React + TypeScript via Vite. React Router for navigation. Tailwind CSS for styling. Plain `fetch` wrapped in a small API client — don't pull in a heavy data-fetching library for an MVP this size.
- **Repo layout:** monorepo —
  ```
  /backend   (Django project + apps)
  /frontend  (Vite React app)
  README.md
  ```
- **Package management:** `venv` + `requirements.txt` for backend, `npm` for frontend.

Explicitly out of scope for this phase (do not add unless asked): Postgres, Docker, Celery, real SSO/OIDC, HRIS/LMS integrations, a design system library. These are Phase 2+ items per the original design doc's roadmap.

## 3. Roles & permissions (simplified for MVP)

Add a `Profile` model (OneToOne with Django's `User`) with `role = CharField(choices=[EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE])`. A user can be an Employee occupying a Position *and* be the Manager of others simultaneously — "Manager" here is a permission tier, not a separate person type. In practice: if you occupy a Position that is another Position's `parent_position`, you manage that position's occupant. The `role` field mainly gates HR Admin and Executive capabilities; manager-of-team permissions are computed from the Position tree at request time.

Permission rules to enforce in DRF permission classes:

- **Employee:** read/write their own `SkillRating`s and profile; read their own `EmployeeCertification`s; read-only on everything else they can see.
- **Manager:** everything an Employee can do, plus: create/update `PositionRequirement` for positions in their reporting subtree (walk down from their own Position via `parent_position`); endorse (update `source`/status on) `SkillRating`s belonging to employees in their subtree; read their team's dashboards.
- **HR Admin:** full CRUD on `Skill`, `SkillCategory`, `ProficiencyScale`, `Role`, `Position`, `Certification`, `LearningResource`; read-only elsewhere (HR reviews, doesn't overwrite, manager-set Position requirements or employee self-assessments).
- **Executive:** read-only on aggregate/dashboard endpoints only; no access to individual skill-rating detail views.

Write a small helper, e.g. `get_subtree_position_ids(position_id)`, used by both the Manager permission checks and the Team Skills Matrix / Gap Analysis endpoints.

## 4. Data model

Split into Django apps as follows. Use `django.db.models`, standard `ForeignKey`/`OneToOneField`, and add `__str__` methods. Register everything in `admin.py`.

### `orgstructure` app

**Role** — the job template.
- `title` (CharField)
- `level` (CharField or IntegerField — your call, document the choice)
- `parent_role` (ForeignKey to self, null=True, blank=True, related_name="child_roles") — career-ladder baseline
- `description` (TextField, blank=True)

**Position** — the org-chart node.
- `role` (ForeignKey to Role, related_name="positions")
- `parent_position` (ForeignKey to self, null=True, blank=True, related_name="direct_reports")
- `department` (CharField)
- `employee` (OneToOneField to Employee, null=True, blank=True, related_name="position") — null = vacancy
- Add a `clean()` method (or a signal) that rejects saves which would create a cycle in `parent_position` (walk up from the new parent; if you hit `self`, reject). Also enforce at most one root (a Position with `parent_position=None`) unless you decide multiple roots are fine for multi-entity companies — default to allowing multiple roots and document that choice.

### `people` app

**Employee**
- `user` (OneToOneField to Django User, null=True, blank=True — not every Employee needs a login immediately)
- `name` (CharField)
- `location` (CharField, blank=True)
- Do **not** add `position_id` here — it's the reverse side of `Position.employee` (see above). Access via `employee.position`.
- Note: an Employee with no Position is "on the bench" (unassigned) — valid state, not an error.

**Profile**
- `user` (OneToOneField to Django User)
- `role` (CharField, choices: EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE)

### `skills` app

**SkillCategory**
- `name` (CharField)
- `parent_category` (ForeignKey to self, null=True, blank=True, related_name="subcategories")

**Skill**
- `name` (CharField, unique with category)
- `category` (ForeignKey to SkillCategory, related_name="skills")
- `description` (TextField, blank=True)
- `taxonomy_version` (IntegerField, default=1) — bump on meaningful redefinition

**ProficiencyScale**
- `skill` (ForeignKey to Skill, null=True, blank=True, related_name="proficiency_scales") — null = applies globally as the default scale
- `levels` (JSONField — ordered list of level names, e.g. `["Novice", "Practitioner", "Advanced", "Expert"]`)

**SkillRating**
- `employee` (ForeignKey to Employee, related_name="skill_ratings")
- `skill` (ForeignKey to Skill, related_name="ratings")
- `proficiency_level` (CharField — validate against the relevant ProficiencyScale)
- `source` (CharField, choices: SELF, MANAGER_ENDORSED, MANAGER_ADJUSTED)
- `evidence` (TextField, blank=True)
- `rated_at` (DateTimeField, auto_now=True)
- `unique_together = ("employee", "skill")` — one current rating per employee per skill; keep history via a simple audit log or a separate `SkillRatingHistory` model if time allows (nice-to-have, not required for MVP)

**PositionRequirement**
- `position` (ForeignKey to Position, related_name="requirements")
- `skill` (ForeignKey to Skill, related_name="position_requirements")
- `min_proficiency` (CharField, validated against the relevant ProficiencyScale)
- `required` (BooleanField, default=True) — False = nice-to-have
- `defined_by` (ForeignKey to Django User, null=True) — the manager who set it
- `unique_together = ("position", "skill")`

### `certifications` app

**Certification**
- `name` (CharField)
- `issuing_body` (CharField, blank=True)
- `validity_period_months` (IntegerField, null=True, blank=True) — null = doesn't expire
- `related_skill` (ForeignKey to Skill, null=True, blank=True, related_name="certifications")

**EmployeeCertification**
- `employee` (ForeignKey to Employee, related_name="certifications")
- `certification` (ForeignKey to Certification, related_name="holders")
- `issued_at` (DateField)
- `expires_at` (DateField, null=True, blank=True)
- `status` (CharField, choices: ACTIVE, EXPIRED, PENDING_RENEWAL — compute this, don't just trust manual input; a management command or property can derive it from `expires_at`)

### `learning` app

**LearningResource**
- `title` (CharField)
- `provider_url` (URLField)
- `skill` (ForeignKey to Skill, related_name="learning_resources")
- `level` (CharField — the proficiency level this resource targets)

### `staffing` app

**Assignment** (Project)
- `name` (CharField)
- `required_skills` (ManyToManyField to Skill, through a simple through-model if you want per-skill min level, otherwise plain M2M is fine for MVP)
- `start_date`, `end_date` (DateField, blank/null=True)

## 5. API design

Use DRF `ModelViewSet` + `DefaultRouter` for standard CRUD on: Role, Position, Employee, SkillCategory, Skill, ProficiencyScale, SkillRating, PositionRequirement, Certification, EmployeeCertification, LearningResource, Assignment. Apply the permission classes from Section 3 per viewset.

Plus these custom endpoints (function-based views or `@action` methods are both fine):

- `GET /api/org-chart/` — returns the Position tree (nested JSON, root(s) down), including vacancy flags. This is what draws the org chart.
- `GET /api/gap-analysis/?scope=position|team|department|company&id=<id>` — for the given scope, compare assigned employees' SkillRatings against their Position's PositionRequirements and return gaps (missing skills, below-minimum-proficiency skills). For vacant positions, return the requirements themselves as open gaps.
- `GET /api/capability-search/?skill=<id>&min_level=<level>` — employees whose SkillRating for that skill meets or exceeds `min_level`, including endorsement status.
- `POST /api/skill-ratings/<id>/endorse/` — manager-only action; sets `source` to `MANAGER_ENDORSED` or `MANAGER_ADJUSTED`.
- `GET /api/position-requirements-overview/` — HR-only; all PositionRequirements grouped by Role, so outliers against a Role's typical bar are visible.

## 6. Frontend screens

Build in this priority order (matches the design doc's screen list). Each is a route in React Router; gate visibility/actions by the logged-in user's role and, where relevant, whether the Position is in their subtree.

1. **My Skills Profile** (`/profile`) — Employee. List of skills with proficiency, evidence, endorsement status. Form to add/update a self-assessment for any taxonomy skill.
2. **Team Skills Matrix** (`/team`) — Manager. Grid of direct/indirect reports × skills, gaps highlighted against their Position's requirements, endorse action inline.
3. **Position Requirements** (`/positions/:id/requirements`) — Manager. Multi-select of skills from the HR taxonomy + minimum proficiency picker, scoped to positions in the manager's subtree.
4. **Org Structure Builder** (`/admin/org-structure`) — HR Admin. Create/edit Role templates and Positions; set each Position's Role and parent; assign/unassign employees.
5. **Org Chart** (`/org-chart`) — everyone (view), HR Admin (edit via drag/drop is a stretch goal — a simple tree view is enough for MVP). Renders from `/api/org-chart/`, vacancies visually distinct.
6. **Gap Analysis Report** (`/reports/gaps`) — Manager/HR. Filterable by team/department/position, calls `/api/gap-analysis/`.
7. **Capability Search** (`/search`) — Manager/Staffing Lead. Skill + min-level + (optional) availability filter.
8. **Skills Taxonomy Admin** (`/admin/skills`) — HR Admin. CRUD for SkillCategory, Skill, ProficiencyScale.
9. **Certifications Tracker** (`/certifications`) — Employee (own) / HR Admin (all). Expiry highlighted.
10. **Org Capability Dashboard** (`/dashboard`) — Executive/Workforce Planner. Aggregate charts: heatmap, bench strength, vacancy count, certification compliance. Simple charts are fine (e.g. a lightweight charting lib or even styled tables/bars) — don't over-invest in visualization polish for the MVP.

## 7. Seed data

Write a management command `python manage.py seed_demo_data` (in `people/management/commands/`) that creates:

- ~5 SkillCategories, ~20 Skills spread across them
- A default global ProficiencyScale (`Novice, Practitioner, Advanced, Expert`)
- ~6 Role templates across 2–3 job families, using `parent_role` to show at least one career ladder (e.g., Engineer I → Engineer II → Senior Engineer)
- ~15–20 Positions forming a 3–4 level org tree, with **at least 2 left vacant** (no employee) to demonstrate that case
- Matching Employee records for the filled Positions, each with a `User`/`Profile` (mix of EMPLOYEE and MANAGER roles; one HR_ADMIN, one EXECUTIVE)
- PositionRequirements for each Position (2–4 skills each)
- SkillRatings for each Employee — some `SELF` only, some `MANAGER_ENDORSED`, deliberately including a few gaps (below the position's minimum) so the Gap Analysis screen has something to show
- 2–3 Certifications with a couple EmployeeCertifications (include one expiring soon, to test the alert logic)
- A few LearningResources

Make the command idempotent or at least safe to note "run once on a fresh DB" in the README.

## 8. Build plan — work through in order, committing after each phase

- **Phase 0 — Scaffolding.** `django-admin startproject`, create the Django apps listed in Section 4, `npm create vite@latest` for the frontend (react-ts template), install Tailwind, set up `.gitignore`, initialize git, stub `README.md`.
- **Phase 1 — Models.** Implement all models from Section 4, including the cycle-prevention validation on `Position.parent_position`. Run makemigrations/migrate. Register everything in Django admin so it's inspectable immediately.
- **Phase 2 — Auth & permissions.** `Profile` model + signal to create one on user creation. DRF permission classes implementing Section 3's rules, including the `get_subtree_position_ids` helper.
- **Phase 3 — Serializers & CRUD API.** DRF serializers + ModelViewSets + router for every model in Section 4.
- **Phase 4 — Custom endpoints.** The five endpoints in Section 5.
- **Phase 5 — Seed data.** Write and run `seed_demo_data`.
- **Phase 6 — Frontend scaffold.** Vite + TS + Tailwind + React Router, a small typed API client (`fetch` wrapper), a login page using Django session auth (or DRF token auth if simpler — your call, document it), and an authenticated layout shell with role-aware nav.
- **Phase 7 — Screens.** Build the ten screens from Section 6 in the listed order. It's fine to ship 1–6 as a fully working slice and treat 7–10 as a follow-up if time runs short — say so explicitly rather than silently shipping half-built screens.
- **Phase 8 — Tests.** Django tests for: the Position cycle validation, the Manager subtree permission boundary (a manager can't edit a Position outside their subtree), and the gap-analysis calculation. A couple of React smoke tests for the API client.
- **Phase 9 — README.** Setup instructions (venv, migrate, seed, runserver; npm install, npm run dev), a one-paragraph architecture summary, and a "known limitations / what's deliberately out of scope" section pointing back to Section 2.

## 9. Working conventions

- Prefer simple, readable code over cleverness — this is an MVP meant to demonstrate the model, not a production system.
- Keep the frontend dependency list small; resist adding a state-management library, UI kit, or data-fetching library unless a specific screen genuinely needs it.
- Every model change should ship with its migration in the same commit.
- If a requirement in this brief conflicts with something that becomes obvious only once you're building it (e.g., a field is missing), make the smallest sensible addition, note it in the commit message, and keep going — don't stop and ask for things at that granularity. Do stop and ask if you're about to make a call that changes the permission model or the Role/Position relationship described in Section 1.
