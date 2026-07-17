# HANDOFF — state of the project and what's next

_Last updated: 2026-07-17, after the UI/UX gap-closure pass._

## Where things stand

**Phases 0–3 of the implementation plan (DESIGN.md §11) are complete**, including a
UI/UX gap-closure pass that brought every screen in line with the spec (DESIGN.md §4–§7).
Deliberate divergences from the spec are documented in **DESIGN.md §12** — read that
before "fixing" something that looks off-spec, it may be intentional.

Note: `CLAUDE.md`, `DESIGN.md`, and `context.md` are **gitignored** (they contain
personal context; see `.gitignore` § "Design docs"). They exist only on this machine —
do not expect them on a fresh clone, and never commit them.

Test surface (all green as of the last commit):

| Suite | Command | Count |
|---|---|---|
| Unit | `docker compose run --rm app npm test` | 170 |
| Integration (db_test) | `docker compose run --rm app npm run test:integration` | 60 |
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

### 1. Phase 4 — Hostinger deploy (DESIGN.md §11, the next milestone)

Nothing here has been started beyond stubs. Steps:

1. **Verify the production Docker build.** `Dockerfile` has `build` and `runtime`
   stages explicitly marked `stub for phase 4`. `@sveltejs/adapter-node` is already a
   dependency but `svelte.config.js` must be checked/switched to it. Gate:
   `docker compose build app --target runtime` succeeds and `node build` serves the app
   against a MySQL instance.
2. **Document Hostinger config in README**: entry point (`build/index.js`), required
   env vars (see `.env.example` / `src/lib/db/pool.ts` for the names), port binding.
3. **Data upload**: dump `db_dev` to a gitignored `.sql` (the `*.sql.gz`/`*.dump`
   patterns are already ignored) and import into Hostinger MySQL manually.
4. **Smoke-test the live site** (create trip → check items → edit settings with a
   removal → confirm the diff modal).

Auth stays at the hosting layer — do not build login (CLAUDE.md § "Don'ts").

### 2. Seed the real catalog (can happen before or after deploy)

The committed catalog (`seed/sample/`) is generic placeholder data. The personal
catalog lives in gitignored `seed/local/`, produced by
`docker compose run --rm app npm run extract:excel` (drop the spreadsheet at
`./.data/source.xlsx` first) and loaded with `npm run seed:local`. Then review the
generated YAML by hand — that's the intended workflow (YAML is the source of truth,
DB is a derived index). Bag ids in the personal catalog should use the keys of
`strings.json → view.bags` (`main_bag`, `small_bag`, `suitcase`, `carry_on`) or the
by-bag view will show raw ids.

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
  `docker compose run --rm app …` (or the `e2e` service for Playwright).
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
