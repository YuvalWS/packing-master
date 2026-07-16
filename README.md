# Packing Master

A parameter-driven Hebrew/RTL packing-list generator. The catalog holds items with conditional inclusion rules and quantity formulas; a trip-specific list is generated from user-selected parameters (accommodation, environment, day plans) plus trip dates.

## Stack

- SvelteKit 2 + TypeScript (strict, `noUncheckedIndexedAccess`)
- Svelte 5 (runes)
- MySQL 8 via `mysql2/promise`
- Migrations: `umzug`
- Validation: `zod`
- Hebrew calendar: `@hebcal/core`
- Icons: `@lucide/svelte`
- Unit/integration: `vitest`
- Component: `@testing-library/svelte`
- End-to-end: Playwright
- Runs entirely in Docker — no host-side installs of node, npm, or mysql required

## Requirements

- Docker Desktop (or compatible Docker engine + Docker Compose v2)

## First-time setup

```bash
cp .env.example .env
docker compose build app                       # bakes node_modules into the image
docker compose build e2e                       # builds the Playwright image (browsers preinstalled)
docker compose up -d db_dev db_test
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:migrate:test
docker compose run --rm app npm run seed:sample
```

## Running the app

```bash
docker compose up app                          # dev server at http://localhost:5173
```

The container points at `db_dev` by default. Override with `APP_DB_TARGET=test` to hit the tmpfs test database (used automatically by the e2e service).

## Tests

| Command                                                | What it runs                                                                 |
|--------------------------------------------------------|------------------------------------------------------------------------------|
| `docker compose run --rm app npm test`                 | Unit tests (pure logic, no DB)                                               |
| `docker compose run --rm app npm run test:integration` | Integration tests (hit `db_test`, tmpfs-backed, reset per run)              |
| `docker compose run --rm app npm run test:component`   | Component tests (`@testing-library/svelte` + jsdom)                         |
| `docker compose run --rm e2e`                          | Playwright end-to-end suite (own container with browsers, points at `db_test`) |
| `docker compose run --rm app npm run check`            | `svelte-check` over the whole tree                                           |
| `docker compose run --rm app npx tsc --noEmit`         | Type-only build                                                              |

The e2e suite drives every key flow (empty list, new-trip, packing-check, kit expand, by-bag, settings rename + regen diff, manual add, items catalog, templates) at mobile viewport and resets the trip tables before each test. A `tests/e2e/screenshots.spec.ts` capture runs alongside it and drops the current state of every screen into `test-results/screenshots/` — handy for a quick visual regression check.

## Common commands

| Command                                                | Purpose                                       |
|--------------------------------------------------------|-----------------------------------------------|
| `docker compose run --rm app npm run db:migrate`       | Apply migrations to dev DB                    |
| `docker compose run --rm app npm run db:migrate:test`  | Apply migrations to test DB                   |
| `docker compose run --rm app npm run seed:sample`      | Load generic sample catalog into dev DB       |
| `docker compose run --rm app npm run seed:local`       | Load local personal catalog into dev DB       |
| `docker compose run --rm app npm run extract:excel`    | Convert source spreadsheet → YAML in `seed/local/` |
| `docker compose down -v`                               | Tear down and wipe dev DB volume              |

## Data layout

- `seed/sample/` — generic placeholder catalog (committed). Useful for fresh-clone bootstraps and documenting YAML shape.
- `seed/local/` — your personal catalog (**gitignored**). Produced by `extract:excel` or hand-edited. Use bag ids from the `view.bags` map in `src/lib/strings.json` (`main_bag`, `small_bag`, `suitcase`, `carry_on`) so the UI can render Hebrew bag names; unknown ids fall back to the raw id.
- `tests/fixtures/` — pure mock data used by unit, integration, and e2e tests.
- Source spreadsheet — stays outside the repo. Drop it into `./.data/source.xlsx` (gitignored) and `PACKING_EXCEL_PATH=/data/source.xlsx` reaches it from the container.

## Project layout

```
src/
  app.html                 dir="rtl" lang="he"
  hooks.server.ts          attaches the DB pool to every request (dev/test by APP_DB_TARGET)
  lib/
    api/                   shared JSON helpers and error shapes
    client/                browser-facing typed API client + per-trip view prefs
    components/            Svelte 5 components (AppShell, PackingListRow, RegenDiffModal, …)
    db/                    pool + per-entity queries + migrate runner
    rules/                 condition evaluator, quantity formulas, derived params, regen merge
    schemas/               Zod schemas for every API boundary
    seed/                  catalog loader, seeder, Excel extractor, CLI
    styles/                design tokens + global reset
    util/                  format-date, format-condition, format-quantity
  routes/
    +layout.svelte         wraps everything in AppShell, marks <html data-hydrated="true">
    +page.svelte           trips list
    trips/new              template picker → details form
    trips/[id]             packing list (categorized/by-bag, check toggle, kit expand, manual add)
    trips/[id]/settings    parameter editor with regen-diff modal
    items, items/[id]      read-only catalog
    templates, templates/[id]  read-only templates
    api/...                trips, items, templates, parameters
tests/
  unit/                    pure logic — no DB
  integration/             hits db_test
  component/               @testing-library/svelte + jsdom
  e2e/                     Playwright; reset-per-test against db_test
  fixtures/                generic test catalog
```

## Privacy / personal data

The committed tree must be free of personal identifying data. Two guards enforce this:

```bash
git grep -iEw 'yuval|weiss|idf|yeshiva'                   # personal-keyword guard, must be empty
git grep -lP '[\x{0590}-\x{05FF}]' -- ':!src/lib/strings.json' ':!seed/local'   # Hebrew is allowed only in the strings file
```

Personal seed data lives in `seed/local/` (gitignored). The source spreadsheet is never committed.

## License

Personal project. No license granted.
