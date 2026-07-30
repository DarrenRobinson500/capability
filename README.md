# Capability

Human Capability Management App — skills/competency tracking, org structure, and gap analysis.

See `docs/CLAUDE.md` for the full project brief and build plan.

## Status

Phase 0 (scaffolding) complete: Django backend (`backend/`) with apps `orgstructure`,
`people`, `skills`, `certifications`, `learning`, `staffing`; React + TypeScript
frontend (`frontend/`) via Vite + Tailwind CSS + React Router. Deploys to Railway
as a single service — Django serves the built React app and the API from one
process. Full setup instructions land in Phase 9 once the app is functional
end-to-end.
