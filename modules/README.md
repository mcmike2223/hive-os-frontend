# Frontend Modules

The Next.js app keeps route files in `app/`, but those route files should be thin shells.
The real feature ownership lives under `frontend/modules/*`.

## Current modules

- `modules/core`: dashboard-adjacent operational features, settings, audit logs, shared API transport.
- `modules/identity`: auth and access management entrypoints.
- `modules/tenancy`: tenant-management entrypoints.
- `modules/hospitality`: lounge and club operations (tables, reservations, service orders).
- `modules/inventory`: inventory control, stock movements, and transaction ledger.
- `modules/Lms`: learning management, courses, learners, reports, and assigned training.

## Rules

- Add nav items through the module manifests, not by hardcoding `components/dashboard/nav.ts`.
- Put module-specific API helpers in that module's `api/` folder.
- Keep `lib/api.ts` as a compatibility facade only.
- Prefer `app/.../page.tsx -> export { default } from "@/modules/..."` for new screens.
