# CLAUDE.md

Instructions for Claude Code working on this repository.

## What this project is

A personal Hebrew/RTL packing-list generator for one or two users. Stores a catalog of items with conditional inclusion rules and quantity formulas, then generates a trip-specific list based on **parameters** (accommodation, environment, day plans) plus trip dates/destination.

Two docs to read before any non-trivial work:

- [context.md](context.md) — original product brief (data model, DSL, API surface, decisions).
- [DESIGN.md](DESIGN.md) — UI/UX spec **and** implementation plan (§11). DESIGN.md supersedes context.md where they conflict — notably:
  - **"Layers" are renamed "parameters"** and split into 3 categories (accommodation = pick one, environment = multi, day plans = multi). DSL operators `any_layer`/`all_layers` become `any_param`/`all_params`. A `seed/*/parameters.yaml` carries the catalog of parameters with Hebrew labels.
  - Trip name is optional (defaults to "{days} days at {accommodation}", rendered in Hebrew via the strings file).
  - Optional items (`?`) are a real concept with a separate counter.
  - Items catalog is **read-only in phase 1**; full editor is phase 2.

**The phased implementation plan lives in DESIGN.md §11.** Work top-to-bottom; do not skip phases.

## Tech stack (locked)

| Concern                            | Choice                                                                 |
|------------------------------------|------------------------------------------------------------------------|
| App framework                      | SvelteKit (server + frontend in one app)                               |
| Language                           | TypeScript (strict)                                                    |
| Database                           | MySQL 8 in dev/test; MariaDB in production (both tested — see below)   |
| Hosting                            | Proxmox LXC on the LAN (native Node 22 + MariaDB, no Docker); later a Cloudflare Tunnel + Cloudflare Access in front |
| MySQL driver                       | `mysql2` (promise API)                                                 |
| Migrations runner                  | `umzug` with `mysql2`-backed storage — chosen, done. No custom migrator. |
| YAML parsing                       | `js-yaml`                                                              |
| Excel parsing (one-shot extractor) | `xlsx` (SheetJS)                                                       |
| Schema validation (API + YAML)     | `zod`                                                                  |
| Hebrew calendar / Shabbat          | `@hebcal/core` — no hand-rolled sunset math                            |
| Hebrew webfont                     | `Heebo` via self-hosted woff2                                          |
| Icons                              | `@lucide/svelte` (matches DESIGN.md inventory)                         |
| Unit + integration tests           | Vitest                                                                 |
| Component tests                    | `@testing-library/svelte`                                              |
| E2E tests                          | Playwright (golden flows only)                                         |

**Reuse aggressively.** If a popular library solves the problem, use it. Do not hand-roll equivalents (no custom test runners, custom ORM, custom validation, custom Excel parser, custom date math).

## Development environment — Docker only

The user develops on Windows and does **not** install node, npm, mysql, or other runtimes on the host. Everything runs in Docker.

Layout:

```
docker-compose.yml          dev stack (app + db_dev + db_test + e2e)
Dockerfile                  Node app image (dev / build / runtime / e2e stages)
.dockerignore
```

Compose services:

- `app` — SvelteKit dev server on port `5173`, source mounted as a volume
- `db_dev` — MySQL 8 for local development; data persisted in a named volume; seeded from the YAML catalog (which is itself generated from the user's source spreadsheet)
- `db_test` — MySQL 8 for tests; data lives in `tmpfs` (fast, ephemeral); schema reset per test run
- `e2e` — Playwright image with browsers preinstalled, points at `db_test`

All host-side commands documented in README must be `docker compose ...`. Never instruct the user to run bare `npm`, `npx`, or `node`.

Examples:

```powershell
docker compose up app              # start dev server at http://localhost:5173
docker compose run --rm app npm test
docker compose run --rm app npm run seed:sample
docker compose run --rm app npm run db:migrate
```

## Two databases for local dev

| DB        | Purpose                          | Data source                          | Committed?        |
|-----------|----------------------------------|--------------------------------------|-------------------|
| `db_dev`  | Manual UI testing during dev     | Excel → YAML → seed script           | Schema yes, data no |
| `db_test` | Automated tests                  | Per-test fixtures inside `tests/`    | Schema yes, data no |

- **Schema** lives in `schema.sql` and migration files — committed.
- **Sample seed YAMLs** (`seed/sample/`) — committed; generic placeholder catalog documenting the YAML shape.
- **Personal seed YAMLs** (`seed/local/`) — NOT committed (gitignored); this is the real catalog reviewed by the user.
- **Raw Excel** — NOT committed. Lives outside the repo; drop a copy at `./.data/source.xlsx` (gitignored) and the extractor reads it via the `PACKING_EXCEL_PATH` env var.
- **MySQL data volumes** — NOT committed.
- The extraction script (`src/lib/seed/extract-from-excel.ts`) reads the Excel and emits YAML into `seed/local/`; run it when the user wants to refresh the catalog.

`.gitignore` must include: `*.dump`, `*.sql.gz`, `/data/`, `/.data/` (holds `backups/` from `npm run backup:dev`), `.env`, `.env.local`, `deploy/.env`, `seed/local/`, and any local DB dumps the user creates.

## Production (Proxmox LXC)

See README § "Deploy: Proxmox LXC". `proxmox/packing-master.sh` runs on the Proxmox host and creates a small unprivileged Debian LXC; `proxmox/install.sh` installs Node.js + MariaDB natively under systemd, builds the app, and installs `update`, the update/check path units and a daily backup timer. Keep the LXC lightweight: **no Docker inside it.**

- **MariaDB compatibility is a requirement.** JSON columns come back as strings from MariaDB; the pool's `typeCast` parses the names listed in `src/lib/db/json-columns.ts` — add any new JSON column there. Avoid MySQL-8-only SQL (`INSERT … AS alias`, `->>`, CTE-heavy tricks). Before changing SQL, run the integration suite against a `mariadb:11.8` container as `DB_TEST_HOST`.
- **Migrations run on server start** (`RUN_MIGRATIONS=1`, `src/hooks.server.ts`); an update needs no manual step.
- **The update button never runs privileged code in the app.** The app writes request files into `CONTROL_DIR`; root-side systemd path units do the work and write `installed.json` / `latest.json` / `update.log` back. `update` backs up first and rolls back to the previous commit if the new build or health check fails.
- **Backups** (`src/lib/server/backup.ts`) are gzipped JSON snapshots of every table; a new table must be added to `BACKUP_TABLES`.
- **The API is the agent surface.** Every `/api` route must be listed in `src/lib/api/catalog.ts` (a unit test enforces it); `/llms.txt`, `/api` and `/api/openapi.json` are rendered from it.

## Testing requirements

Minimum coverage explicitly required:

1. **Condition evaluator** (`src/lib/rules/evaluator.ts`) — exhaustive unit tests for every operator (`and`, `or`, `not`, `eq`, `gte`, `any_param`, `all_params`, `includes_shabbat`, literal `true`, string param). Edge cases: missing params, unknown operators, deeply nested expressions, empty arrays.
2. **Quantity formula evaluator** — every formula type (`fixed`, `per_day`, `per_n_days`, `per_weekday`, `per_shabbat`, `days_plus`) with realistic trip durations.
3. **Derived trip parameters** (`src/lib/rules/derived.ts`) — `days`, `weekdays`, `has_shabbat`, `shabbat_count`, `long_trip`, `short_trip` against known dates. Use the Hebrew calendar library; test boundary cases (trip starts Friday afternoon, ends Saturday night, cross-month, cross-year).
4. **Regeneration diff merger** — the merge logic in `mergeIntoTrip`. Test that manual items are never touched, edited counts are preserved, removed items appear in `to_be_removed`, and added items insert with safe defaults.

Pure logic tests use no DB. Integration tests hit `db_test` (tmpfs, reset per run). Component tests via `@testing-library/svelte`. E2E (Playwright) only for golden flows.

Run via `docker compose run --rm app npm test` (see README for the full suite table).

**Per-phase test gates are spelled out in DESIGN.md §11.**

## Code conventions

- **TypeScript strict mode.** No `any` unless commented with a reason.
- **No comments unless the *why* is non-obvious.** Don't narrate what the code does.
- **Hebrew lives ONLY in `src/lib/strings.json`** (and the gitignored `seed/local/` personal catalog). Never hardcode Hebrew anywhere else — not in `.ts`, not in `.svelte`, not in tests, not in comments, not in docs. Tests import the strings file rather than re-typing Hebrew.
- **RTL is a layout concern, not a string concern.** `dir="rtl"` is set on `<html>` in `app.html`; CSS logical properties (`margin-inline-start`, etc.) handle the rest. Beware: CSS transforms are **not** direction-aware — see the RTL-centering pattern in `Modal.svelte`.
- **Server code in `+page.server.ts` / `+server.ts`** — no direct DB access from `+page.svelte` files.
- **Validation** at the API boundary using Zod. Internal functions trust their inputs.
- **Parameterized queries always.** Never string-concatenate SQL.

## Workflow rules

1. **Design before code.** When the user asks for a new feature or screen, write the design change (in `DESIGN.md` or a sub-doc) and confirm before implementing.
2. **YAML is the catalog source of truth.** Edits to items/templates happen in the seed YAML first, then re-seeded into `db_dev`. The DB is a derived index.
3. **Never silently destroy user trip edits.** All regeneration must surface a diff (added / updated / to-be-removed) and require explicit confirmation before deleting `trip_items` rows. See `context.md` § "Regeneration safety".
4. **`is_manual=true` rows are sacred.** The rules engine never modifies them.
5. **The five most recently updated spreadsheet tabs are authoritative** for default quantities and naming (see context.md § "Source data"). Other tabs contribute unique items only.
6. **Two users max.** Don't add user-scoping, RBAC, sharding, caching layers, queues, or other infra for scale. Pick the boring path.
7. **No auth in the app.** LAN-only for now; remote access will go through Cloudflare Access (service tokens for agents). Don't write login screens, sessions, or a users table for v1.
8. **Privacy guards before every commit** — see README § "Privacy / personal data". No personal identifying data and no Hebrew (outside the strings file) in the committed tree.

## File map (current)

```
.
├── CLAUDE.md                       this file
├── DESIGN.md                       UI/UX spec + implementation plan (§11) + divergences (§12)
├── context.md                      product spec (DSL, schema, API, decisions) — historical, DESIGN.md wins
├── HANDOFF.md                      current status + what's-next
├── README.md                       how to run (Docker commands) + deploy + agent API
├── proxmox/                        packing-master.sh (Proxmox host helper) + install.sh (LXC installer/updater)
├── deploy/                         compose.yml: optional production stack for any Docker host
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── .gitignore
├── package.json
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts / vitest.*.config.ts / playwright.config.ts
├── schema.sql                      DDL (canonical)
├── migrations/                     ordered .sql files for incremental changes
├── seed/
│   ├── sample/                     generic placeholder catalog (committed): items/templates/parameters yaml
│   └── local/                      personal catalog (gitignored); produced by extract:excel or hand-edited
├── src/
│   ├── app.html                    dir="rtl" lang="he"
│   ├── app.d.ts
│   ├── hooks.server.ts             attaches DB pool per request (dev/test via APP_DB_TARGET)
│   ├── lib/
│   │   ├── strings.json            ALL Hebrew UI strings (sole allowed Hebrew outside seed/local)
│   │   ├── rules/
│   │   │   ├── evaluator.ts        condition DSL eval
│   │   │   ├── quantity.ts         quantity formula eval
│   │   │   ├── derived.ts          days, has_shabbat, etc.
│   │   │   ├── shabbat.ts          wraps @hebcal/core
│   │   │   ├── generate.ts         trip generation pipeline
│   │   │   └── merge.ts            regeneration diff
│   │   ├── seed/                   YAML loader, seeder, Excel extractor, CLI
│   │   ├── db/
│   │   │   ├── pool.ts             mysql2 pool
│   │   │   ├── migrate.ts          umzug runner
│   │   │   └── queries/            one file per entity
│   │   ├── schemas/                Zod schemas for API I/O + YAML
│   │   ├── api/                    JSON/error helpers for +server.ts handlers
│   │   ├── client/                 typed browser API client + per-trip view prefs
│   │   ├── util/                   format-date/condition/quantity, bag-label, trip-name, …
│   │   ├── actions/                Svelte actions (focus-trap)
│   │   ├── styles/                 tokens.css + global.css
│   │   └── components/             Svelte components
│   └── routes/
│       ├── +layout.svelte
│       ├── +error.svelte           Hebrew error page
│       ├── +page.svelte            trips list
│       ├── trips/
│       │   ├── new/+page.svelte
│       │   └── [id]/
│       │       ├── +page.svelte
│       │       ├── +page.server.ts
│       │       └── settings/+page.svelte
│       ├── items/+page.svelte      (+ items/[id])
│       ├── templates/+page.svelte  (+ templates/[id])
│       └── api/
│           ├── items/...
│           ├── templates/...
│           ├── parameters/...
│           └── trips/...
└── tests/
    ├── unit/                       pure logic — no DB
    ├── integration/                hits db_test
    ├── component/                  @testing-library/svelte + jsdom
    ├── e2e/                        Playwright; reset-per-test against db_test
    └── fixtures/                   generic mock catalog (English)
```

## What's done vs. pending

- [x] Product spec in `context.md`
- [x] CLAUDE.md (this file)
- [x] DESIGN.md — UI/UX spec, parameter model, phase 2+ plan, **implementation order in §11**
- [x] **Phase 0** — Docker + SvelteKit + Vitest scaffold
- [x] **Phase 1** — data layer + rules engine + tests
- [x] **Phase 2** — API surface
- [x] **Phase 3** — UI screens (incl. a UI/UX gap-closure pass vs. DESIGN.md §4–§7 — July 2026; deliberate divergences listed in DESIGN.md §12)
- [x] **Phase 4** — deploy to a Proxmox LXC (Nov 2026): helper script, native installer, update button with rollback, backups, agent API docs. Remote access via Cloudflare Tunnel + Access is still to do.
- [ ] **Phase 5+** — items editor (easy mode → advanced block builder), tasks list, shopping list

See [DESIGN.md §11 — Implementation order & testing plan](DESIGN.md) for the detailed per-step breakdown, and `HANDOFF.md` for the current what's-next.

## Don'ts

- Don't add tasks list, shopping list, optional/priority levels, joint-list UI, weight tracking, offline support, holiday detection beyond Shabbat, multi-language, or trip sharing. All deferred to post-v1. See `context.md` § "Out of scope for v1".
- Don't introduce React, Tailwind plugins, or other heavy frontend deps before checking with the user. Default to SvelteKit's built-ins.
- Don't write a custom auth layer. Access control belongs to Cloudflare Access (later) / the LAN (now).
- Don't commit Excel files, MySQL dumps, `.env` files, or anything from `seed/local/`.
- Don't install anything on the host — every command runs through `docker compose`.
- Don't put Hebrew anywhere except `src/lib/strings.json` and `seed/local/`.
