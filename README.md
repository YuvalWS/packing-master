# Packing Master

A parameter-driven packing list generator. Catalog of items with conditional inclusion rules and quantity formulas; generates a trip-specific list based on user-selected parameters (accommodation, environment, day plans) and trip dates.

## Stack

- SvelteKit + TypeScript (strict)
- MySQL 8
- Vitest (unit + integration)
- Runs entirely in Docker — no host-side installs required

## Requirements

- Docker Desktop (or compatible Docker engine + Docker Compose v2)

## Setup

```bash
cp .env.example .env
docker compose build app
docker compose up -d db_dev db_test
docker compose run --rm app npm install
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:migrate:test
```

## Common commands

| Command                                                | Purpose                                       |
|--------------------------------------------------------|-----------------------------------------------|
| `docker compose up app`                                | Start the dev server at http://localhost:5173 |
| `docker compose run --rm app npm test`                 | Run all unit + integration tests              |
| `docker compose run --rm app npm run test:watch`       | Vitest in watch mode                          |
| `docker compose run --rm app npm run db:migrate`       | Apply migrations to dev DB                    |
| `docker compose run --rm app npm run db:migrate:test`  | Apply migrations to test DB                   |
| `docker compose run --rm app npm run seed:sample`      | Load generic sample data into dev DB          |
| `docker compose run --rm app npm run seed:local`       | Load local personal data into dev DB          |
| `docker compose run --rm app npm run extract:excel`    | Convert source spreadsheet → YAML in seed/local/ |
| `docker compose down -v`                               | Tear down and wipe dev DB volume              |

## Data layout

- `seed/sample/` — generic placeholder catalog (committed). Useful for fresh-clone bootstraps and documenting YAML shape.
- `seed/local/` — your personal catalog (gitignored). Produced by `extract:excel` or hand-edited.
- `tests/fixtures/` — pure mock data used by unit and integration tests.
- Source spreadsheet — stays outside the repo. Mount it into the container and set `PACKING_EXCEL_PATH`.

## Testing

```bash
docker compose run --rm app npm test
```

Unit tests run in pure Node. Integration tests connect to `db_test` (tmpfs-backed, reset per `docker compose down -v`).

## License

Personal project. No license granted.
