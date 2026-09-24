# Renuzi Stock Reconciliation & Variance Platform

Automated stock reconciliation for Renuzi Ventures (Ketu & Lekki warehouses).
See `PROJECT_CONTEXT.md` for permanent project memory.

## Status — Phase 1

Authentication, role-based access control, and the daily 18:00 WAT cutoff lock.

- JWT auth (`jsonwebtoken` + `bcryptjs` hashing — pure-JS bcrypt, `$2b$` compatible hashes)
- Users stored in `server/data/users.json` (no database)
- Roles: `super_admin` (passes every role guard, owns user management), `admin` (full), `executive` (read-all, bypasses location checks), `warehouse_manager` (own location only)
- User management API (super_admin only): list, create, deactivate — accounts are never deleted, only soft-disabled (`deactivated: true` rejects login and existing tokens with 401)
- Daily cutoff lock: writes are only allowed for **today's** date in **Africa/Lagos** and only **before 18:00 WAT**; anything else returns `403 { "error": "LOCKED_FOR_AUDIT" }`

## Quickstart

```bash
npm install
npm run seed --workspace server   # (re)generate server/data/users.json
npm run server                    # API on http://localhost:4000
npm run client                    # UI  on http://localhost:5173
```

## Seeded users (development credentials)

| Email            | Password     | Role               | Location |
| ---------------- | ------------ | ------------------ | -------- |
| temidire@renuzi  | Super@2026   | super_admin        | —        |
| admin@renuzi     | Admin@2026   | admin              | —        |
| ketu@renuzi      | Ketu@2026    | warehouse_manager  | Ketu     |
| lekki@renuzi     | Lekki@2026   | warehouse_manager  | Lekki    |

Re-run the seed script at any time; it upserts these accounts and keeps any
extra users you add by hand. **Rotate these credentials before any real deployment.**

## API

| Method | Path                                   | Auth            | Notes                                                       |
| ------ | -------------------------------------- | --------------- | ----------------------------------------------------------- |
| POST   | `/api/v1/auth/login`                   | —               | `{ email, password }` → `{ token, user }`                   |
| GET    | `/api/v1/auth/me`                      | Bearer JWT      | → `{ user }`                                                |
| GET    | `/api/v1/admin/users`                  | super_admin     | → `{ users }` sanitized, incl. `deactivated` flag           |
| POST   | `/api/v1/admin/users`                  | super_admin     | `{ email, name, role, location?, password }` → 201 `{ user }`; 409 `EMAIL_EXISTS` |
| PATCH  | `/api/v1/admin/users/:id/deactivate`   | super_admin     | soft-disable; 400 `CANNOT_DEACTIVATE_SELF`, 404 unknown id  |
| GET    | `/api/v1/health`                       | —               | liveness probe                                              |

All non-GET routes except `/auth/login` pass through the cutoff guard:
`403 { "error": "LOCKED_FOR_AUDIT" }` once the Lagos clock reaches `CUTOFF_HOUR`,
or whenever the request targets any date other than today (Lagos).

Middleware (server/src/middleware):

- `requireAuth` — verifies the Bearer JWT and re-checks the user still exists and is not deactivated
- `requireRole(...roles)` — 403 `FORBIDDEN` unless the role matches; a `super_admin` passes every guard
- `requireLocation` — managers may only act on their own location (resolved
  from `params`/`body`/`query`); admins and executives bypass
- `requireCutoffOpen` — the daily audit lock described above

## Tests

```bash
npm test --workspace server
```

Cutoff tests mock the clock and pin instants with explicit `+01:00` offsets, so
they pass on any host timezone: 17:59 WAT today = open, 18:00/18:01 WAT =
locked, any non-today date = locked. Additional suites cover the middleware and
the login/me/admin HTTP flows.

## Configuration

Copy `server/.env.example` to `server/.env` (and `client/.env.example` to
`client/.env`). Key variables: `JWT_SECRET`, `CUTOFF_HOUR` (default 18),
`CLIENT_ORIGIN`, `VITE_API_BASE_URL`. `TZ=Africa/Lagos` is recommended but the
cutoff logic derives Lagos time via `Intl` and is host-timezone independent.
