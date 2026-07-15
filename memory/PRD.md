# SIGMA — Sistem Informasi Manajemen Aset (PRD)

## Problem Statement (Original)
Build SIGMA, an enterprise Asset Location Tracking application: track current asset position and the complete movement history between offices/rooms. History must never be lost when an office/room is deleted. Premium Enterprise SaaS UI (Linear/Vercel/SAP Fiori inspiration), mandatory color palette (Primary #01567A, Secondary #92BA3C), GitHub/Jira-style timeline, Clean Architecture separation.

## User Choices
- Stack: FastAPI + React + MongoDB (adapted from original MySQL/Laravel spec)
- Pages: Dashboard (asset table + search + filter) AND Asset Detail
- CRUD: Full CRUD for Offices, Rooms, Assets
- Auth: JWT login (email/password, httpOnly cookies)

## Architecture
- Backend (Clean Architecture): `core.py` (DB, security), `schemas.py` (DTO), `repositories.py` (data access), `services.py` (business logic — no logic in routes), `routes.py` (controllers), `seed.py` (idempotent seed), `server.py` (wiring)
- Frontend: `components/` (layout, common reusables), `features/assets/` (MoveAssetForm, HistoryTimeline, AssetFormDialog), `pages/`, `services/api.js`, `context/AuthContext`, `lib/format.js`
- History preservation: asset_logs store denormalized office/room NAMES (Mongo equivalent of ON DELETE SET NULL — better: names never lost)

## Data Model (MongoDB, uuid string _id)
- users(email unique, password_hash bcrypt, name, role)
- offices(nama_kantor), rooms(office_id, nama_ruangan)
- assets(kode_aset unique, nama_aset, current_office_id, current_room_id, last_moved_at)
- asset_logs(asset_id, from/to office+room ids AND names, moved_by, notes ≤500, moved_at)

## API (all /api, JWT protected except auth)
- Auth: POST /auth/register, /auth/login, /auth/logout, GET /auth/me
- GET/POST/PUT/DELETE /offices, /rooms (?office_id=)
- GET /assets (search, office_id, page, limit), GET/POST/PUT/DELETE /assets/{id}
- GET /assets/{id}/history (page, limit, date_from, date_to, office_id)
- POST /assets/{id}/move {office_id, room_id, notes} — full validation (office/room exist, room in office, not same location, notes ≤500), rollback on failure
- GET /stats

## Implemented (15 Jun 2026) — MVP Complete ✅
- JWT auth (login page, protected routes, logout, admin seed)
- Dashboard: stats cards, asset table with debounced search, office filter, pagination, row-click navigation, asset CRUD dialogs
- Asset Detail: breadcrumb, title/kode/status badges, Informasi Asset card, Lokasi Saat Ini card, Mutasi form (searchable cascading office→room selects, notes counter, confirmation dialog, toasts)
- Timeline (main focus): GitHub-style vertical line, circle nodes, green POSISI SEKARANG node+badge, from→to location chips, user, notes, date; Framer Motion fade-in; date & office filters; pagination; empty states; skeletons
- Offices & Rooms CRUD pages with delete-preserves-history warnings
- Seed: 3 offices, 10 rooms, 10 assets, 5 movement logs
- Testing: 27/27 backend pytest pass, full UI flows verified (iteration_1)

## Credentials
admin@sigma.co.id / Sigma@2026 (see /app/memory/test_credentials.md)

## Backlog
- P1: User management page (register is API-only), role-based permissions (admin vs user)
- P1: Export history to CSV/PDF
- P2: Brute-force login lockout, password reset flow
- P2: QR-code asset labels for scanning
- P2: Global activity feed (all assets' recent moves) on dashboard
