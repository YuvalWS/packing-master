# HANDOFF — state of the project and what's next

_Last updated: 2026-11-19, after the Proxmox LXC deploy pass (backups, update button, agent API)._

## Where things stand

**Phases 0–3 of the implementation plan (DESIGN.md §11) are complete**, including a
UI/UX gap-closure pass that brought every screen in line with the spec (DESIGN.md §4–§7).
Deliberate divergences from the spec are documented in **DESIGN.md §12** — read that
before "fixing" something that looks off-spec, it may be intentional.

Note: `CLAUDE.md`, `DESIGN.md`, and `context.md` are committed and fully English
(translated and scrubbed of personal specifics in July 2026). The personal catalog —
real item names, templates, and parameters, all in Hebrew — lives only in the
gitignored `seed/local/` and the source spreadsheet outside the repo.

Test surface (all green as of the last commit):

| Suite | Command | Count |
|---|---|---|
| Unit | `docker compose run --rm app npm test` | 195 |
| Integration (db_test) | `docker compose run --rm app npm run test:integration` | 66 (also green on MariaDB 11.8) |
| Component (jsdom) | `docker compose run --rm app npm run test:component` | 76 |
| E2E (Playwright in Docker) | `docker compose run --rm e2e` | 29 |
| Types/lint | `docker compose run --rm app npm run check` | 0 errors |

The e2e screenshots spec drops one PNG per screen into `test-results/screenshots/`
(including a row-actions-sheet, error-page, and 1280px-desktop capture) — the quickest
way to eyeball a regression.

### What the gap-closure pass changed (short version)

- **Fixed a severe RTL bug**: `Modal`/`Toast` had sign-inverted `translateX` overrides
  under `html[dir='rtl']` — the regen modal rendered almost entirely off-screen on
  phones. Root cause: `inset-inline-start: 50%` resolves to `right` in RTL, so
  centering needs `translateX(+50%)`. If you add a new fixed-position overlay, follow
  the pattern in `Modal.svelte` (including the ≥960px permanent-drawer offset).
- The PATCH `/api/trips/:id` diff payload changed shape: snake_case, display names on
  all three buckets, `previous_count`/`new_count`, `is_checked` on removals.
- New UI: per-row ⋯ menu (`RowActionsSheet` — bag split / note / manual delete),
  packing-list search + tap-to-cycle counter filter, trip-level ⋯ menu (delete),
  trip-header meta with shabbat info, `ParamChipList` (+N truncation), new-trip step
  indicators + read-only derived-params section + live name placeholder,
  upcoming/past trip sections with a completed badge, items-catalog filters and rule
  summaries, root `+error.svelte`, focus traps, reduced-motion support.

## What's next, in order

### 1. Phase 4 — deploy (done for the LAN; target changed from Hostinger to a Proxmox LXC)

Done in November 2026 (see README § "Deploy: Proxmox LXC"):

- `proxmox/packing-master.sh` creates a small Debian LXC; `proxmox/install.sh` installs
  Node.js 22 + MariaDB natively under systemd (no Docker), builds, and installs `update`,
  the update/check path units and a daily backup timer. Private repo → per-container
  read-only GitHub deploy key.
- MariaDB compatibility: JSON columns are parsed by name in the pool's `typeCast`
  (`src/lib/db/json-columns.ts`). Run the integration suite against MariaDB with a
  `mariadb:11.8` container as `DB_TEST_HOST` before changing SQL.
- Backups (`/api/backups`, System settings page): gzipped JSON snapshots, restore in one
  transaction with an automatic pre-restore backup. `npm run backup:dev` carries the dev
  catalog to a fresh install.
- Update button: the app only writes request files into `CONTROL_DIR`; root-side systemd
  units do the work (same pattern as the sound-detector project).
- Agent API: `/llms.txt`, `/api`, `/api/openapi.json` from `src/lib/api/catalog.ts`.

Open items:

- `CLAUDE.md` and `DESIGN.md` §11 still say Hostinger — update them once the user acks.
- Remote access later: Cloudflare Tunnel + Cloudflare Access (service tokens for agents).
  `PROTOCOL_HEADER=x-forwarded-proto` is already set; there are no form actions, so
  SvelteKit's origin check does not need `ORIGIN`.
- `deploy/compose.yml` (Docker + MySQL 8) is an alternative for any Docker host; the LXC
  does not use it.

### 2. Review the generated personal catalog

Done, but it is a *draft*. `src/lib/seed/extract-from-excel.ts` was rewritten as a
config-driven engine (pure transform in `src/lib/seed/extract.ts`, config schema in
`src/lib/schemas/extract-config.ts`): the personal mapping lives in the gitignored
`seed/local/extract-config.yaml`, which declares the parameter catalog, which sheets
become templates, and which `(column, row-range)` carries which category / bag /
parameters. Running `npm run extract:excel` currently yields 22 parameters, 278 items
and 9 templates, loaded into `db_dev` with `npm run seed:local`.

What still wants a human pass:

- Every generated item carries a `# REVIEW:` comment naming its source sheets and
  flagging guessed quantities. Most quantities are `fixed: 1`; only the clothing
  staples got real formulas (`per_day`, `per_n_days`, `per_shabbat`).
- Conditions are derived from the parameters attached to the columns an item appeared
  in. Items found on 4+ templated sheets became unconditional base items
  (`base_threshold` in the config). Items seen on a single sheet often end up with an
  `all_params` condition that is narrower than reality.
- `seed/local/extract-report.txt` lists the cells in unmapped columns — mostly
  personal notes and shopping lists that were deliberately left out.
- A few institution-stay sheets are declared with `skip: true` in the config. Their items
  are near-duplicates of the sheets already mapped; flip the flag and add column maps
  to fold them in.
- Editing the YAML by hand and re-running `seed:local` stays the intended workflow —
  a re-run of `extract:excel` overwrites `items.yaml`, so fold durable corrections
  back into the config (`aliases`, `quantity_rules`, `item_overrides`).

### 2b. Catalog write API (done November 2026, DESIGN.md §10.0)

The live DB is now the catalog's source of truth; an AI agent edits it over the API.
`npm run catalog:pull -- <url>` exports it back to `seed/local/`. Items used by trips are
archived (`items.archived_at`, migration 0003) instead of deleted. The editor UI below
should be a client of these endpoints, not a new write path.

### 2c. Multi-person trips (done November 2026, DESIGN.md §13)

People (`/people`, `/api/people`), "Who's coming" on new trip / settings, items scoped
`per` family / person / adult / kid / baby with `split` (row per person vs one summed
row) or tied to one `person_id`. Trip rows carry `person_id`; address them by `row_id`.
Migration 0004 retired `items.is_shared`: personal items were tied to an `owner`
person (rename it in the Family page) and old trips got `travelers = ["owner"]`;
`backup.ts` upgrades pre-0004 backups the same way. When the second adult starts
using the app, un-tie personal items (`PATCH /api/items/{id}` with `person_id: null`)
so they become per-person rows. `seed/local/*.yaml` still has the old `is_shared`
shape: refresh it with `npm run catalog:pull -- <url>` rather than `seed:local`.

### 3. Phase 5 — items editor, easy mode (DESIGN.md §10.1)

The read-only catalog is done; the editor is the next feature phase. Easy mode is a
parameter-checkbox form that compiles to `any_param`/`all_params` conditions. Useful
building blocks that already exist:

- `src/lib/util/condition-params.ts` — walks the condition DSL, returns referenced
  param ids (use it to decide whether a rule fits easy mode: it fits iff the condition
  is `true`, a bare param, or a single `any_param`/`all_params`).
- `ParameterSelector.svelte` — the 3-category picker, easily adapted to checkboxes.
- Zod schemas in `src/lib/schemas/` validate any condition the editor writes.
- **Design first**: per the workflow rules, write the design change and get it
  confirmed before implementing. Remember edits must flow YAML-first (or decide and
  document a deliberate exception for the editor — this is an open product question:
  the editor writes to the DB, but YAML is the declared source of truth. Resolve
  before coding.)

Advanced mode (block builder) can slip to a later phase; a JSON textarea is an
acceptable stopgap per the spec.

### 4. Small deferred items (documented in DESIGN.md §12)

- **Duplicate trip** — needs a `POST /api/trips/:id/duplicate` endpoint and
  product decisions (reset checks? copy manual items? shift dates?). UI slots exist
  (trip ⋯ menu).
- **Template recent/all split** on the new-trip screen — revisit once there's usage
  data or the real template catalog is large.
- **Heebo font files** are not committed; drop the two `.woff2` files into
  `static/fonts/` per `static/fonts/README.md` (the e2e logs show harmless 404s until
  then; the UI falls back to system fonts).
- **Dark theme** — tokens are centralized in `src/lib/styles/tokens.css`, so a
  `prefers-color-scheme` variant is mostly a token exercise. Spec lists it as an
  enhancement, not v1.

### 5. Post-v1 parking lot (do NOT start without asking)

Tasks list, shopping list, bag-weight tracking, trip export, joint-list UI,
mutually-exclusive item groups, holiday detection beyond Shabbat — see DESIGN.md §10.3
and CLAUDE.md § "Don'ts".

## Conventions that will bite you if forgotten

- **Docker only.** Never run bare `npm`/`node` on the host; every command goes through
  `docker compose run --rm app …` (or the `e2e` service for Playwright). The dev
  server's host port is `APP_PORT_HOST` in `.env` (5173 by default; Hyper-V reserves
  that range on some Windows machines).
- **Hebrew only in `src/lib/strings.json`** (and `seed/local/`). Tests import strings
  from there — never re-type Hebrew literals, not even in comments. Guard:
  `git grep -lP '[\x{0590}-\x{05FF}]' -- ':!src/lib/strings.json' ':!seed/local'`
  must print nothing.
- **Personal-keyword guard** before commits: run the exact `git grep -iEw …` command
  from README § "Privacy / personal data"; it must only hit the README line that
  documents the guard itself.
- **CSS logical properties** everywhere; remember transforms are *not*
  direction-aware (see the RTL centering bug above).
- **Never silently delete trip rows** — all regeneration flows through the diff modal
  (`to_be_removed` is only committed via `POST /api/trips/:id/regenerate`).
- `is_manual=true` rows are untouchable by the rules engine; UI delete exists only for
  them.
- Conventional commits, one logical change each, no amends.
- Run all five gate commands (table above) before calling a milestone done.
