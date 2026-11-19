# Packing Master

A parameter-driven Hebrew/RTL packing-list generator. The catalog holds items with conditional inclusion rules and quantity formulas; a trip-specific list is generated from user-selected parameters (accommodation, environment, day plans) plus trip dates.

## Stack

- SvelteKit 2 + TypeScript (strict, `noUncheckedIndexedAccess`)
- Svelte 5 (runes)
- MySQL 8 via `mysql2/promise` (production on the LXC uses MariaDB; both are tested)
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

If port 5173 is taken (on Windows, Hyper-V reserves whole port ranges — check with
`netsh int ipv4 show excludedportrange protocol=tcp`), set `APP_PORT_HOST` in `.env`
to a free port; the container keeps listening on 5173 internally.

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
| `docker compose run --rm app npm run backup:dev`       | Back up the dev DB to `.data/backups/` (upload it to a deploy to restore) |
| `docker compose run --rm app npm run catalog:pull -- <url>` | Write a deployed install's live catalog to `seed/local/*.yaml` |
| `docker compose down -v`                               | Tear down and wipe dev DB volume              |

## Deploy: Proxmox LXC (LAN)

A small unprivileged Debian LXC: Node.js 22 and MariaDB run natively under systemd, no
Docker (about 150 MB RAM idle, ~1.5 GB disk). LAN only, no login; for access from outside,
put a Cloudflare Tunnel with Cloudflare Access in front later.

1. Copy the helper to the Proxmox host and run it as root (the repository is private, so
   it is copied rather than curled):

   ```powershell
   scp proxmox/packing-master.sh root@<proxmox-host>:/root/
   ```

   then, on the Proxmox shell: `bash /root/packing-master.sh`. It asks for the GitHub
   repository (`owner/name`), creates the container (defaults: 2 cores, 1 GB RAM + 1 GB swap,
   4 GB disk, DHCP), generates a read-only deploy key inside it and waits while you add the
   key at `https://github.com/<owner>/<name>/settings/keys/new`. Then it installs and
   prints the URL.
2. Bring the catalog over: `docker compose run --rm app npm run backup:dev`, then in the
   deployed app open **System settings → Backups → upload**, pick the file from
   `.data/backups/`, and **Restore** it.

On the container (`pct enter <ctid>`):

| Command | Purpose |
|---|---|
| `update` | Back up, pull the latest commit, rebuild, restart; rolls back if the new version is unhealthy |
| `journalctl -u packing-master -f` | App logs |
| `systemctl status packing-master mariadb` | Service state |
| `/etc/packing-master/env` | Settings (port, DB password, paths) |
| `/var/lib/packing-master/backups/` | Backups (daily at 03:30, before each update and restore) |

The **Update** button in System settings does the same as `update`: the app writes a
request file to `/var/lib/packing-master/control/`, and a systemd path unit runs the update
as root and writes `update.log`, which the page shows.

The Docker route also works on any host: `deploy/compose.yml` runs the production image
with MySQL 8 (`docker compose -f deploy/compose.yml --env-file deploy/.env up -d --build`).

## API for programs and AI agents

The UI's JSON API is the integration surface; nothing is UI-only.

- `GET /llms.txt` — guide for agents: concepts, common tasks, safety rules.
- `GET /api` — endpoint index with JSON schemas and examples.
- `GET /api/openapi.json` — OpenAPI 3.1, for tool-calling clients.

Agents can manage trips, the family (`/api/people`) and the catalog itself: items with
their rules, quantities and who they are for, templates and parameters (`POST/PATCH/DELETE /api/items|templates|parameters`), dry-run a
rule with `POST /api/catalog/preview`, and push catalog changes into an existing trip with
`POST /api/trips/{id}/reapply`. `/llms.txt` documents the rules language.

All three are rendered from `src/lib/api/catalog.ts`; a unit test fails if a route under
`src/routes/api/` is missing from it. Behind Cloudflare Access, give an agent a service
token and have it send `CF-Access-Client-Id` / `CF-Access-Client-Secret`.

## Data layout

- `seed/sample/` — generic placeholder catalog (committed). Useful for fresh-clone bootstraps and documenting YAML shape.
- `seed/local/` — your personal catalog (**gitignored**). Once deployed, the live database is the source of truth and `npm run catalog:pull` refreshes these files from it; originally produced by `extract:excel`. Also holds `extract-config.yaml` (the spreadsheet mapping, see below) and `extract-report.txt`. Use bag ids from the `view.bags` map in `src/lib/strings.json` (`main_bag`, `small_bag`, `suitcase`, `carry_on`) so the UI can render Hebrew bag names; unknown ids fall back to the raw id.
- `tests/fixtures/` — pure mock data used by unit, integration, and e2e tests.
- Source spreadsheet — stays outside the repo. Drop it into `./.data/source.xlsx` (gitignored) and `PACKING_EXCEL_PATH=/data/source.xlsx` reaches it from the container.

## Importing a personal spreadsheet

The spreadsheet is a free-form grid — several column blocks per sheet, each under a
category header, with quantities baked into names (`3 shirts`, `socks*8`) and `?`
marking a maybe. None of that is inferable, so the extractor is config-driven:

1. Drop the workbook at `./.data/source.xlsx`.
2. Write `seed/local/extract-config.yaml` — the schema lives in
   `src/lib/schemas/extract-config.ts`. It declares the parameter catalog, which
   sheets become templates, and, per sheet, which `(column, row-range)` maps to which
   category / bag / parameters. Grid sheets use `columns:`; a sheet that is a real
   table (one row per item) uses `mode: table`. `ignore`, `aliases`,
   `quantity_rules`, and `item_overrides` clean up the rest.
3. `docker compose run --rm app npm run extract:excel`
4. Read `seed/local/extract-report.txt`: it lists cells in unmapped columns (nothing
   is dropped silently), what the ignore list swallowed, items seen only once, and
   items whose quantity fell back to `fixed: 1`. Adjust the config and re-run.
5. Review the `# REVIEW:` comments in the generated `items.yaml`, then
   `docker compose run --rm app npm run seed:local`.

The generated catalog is a draft: conditions come from the parameters attached to the
columns an item appeared in, and an item seen on `base_threshold` or more templated
sheets becomes an unconditional base item.

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
    items, items/[id]      catalog (read-only UI; editable through the API)
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
