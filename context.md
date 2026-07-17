# Packing List Generator — Project Context

This document captures the original design conversation, handed off to Claude Code before implementation started. It contains every decision made, why it was made, and what was pending at the time.

> **Status note:** this is the historical product brief. Where it conflicts with [DESIGN.md](DESIGN.md), DESIGN.md wins (notably: "layers" became "parameters", and some column names drifted — e.g. `name_he` shipped as `display_name`). Personal specifics from the original brief (spreadsheet tab names, personal item examples) have been replaced with generic equivalents; the real catalog lives in the gitignored `seed/local/`.

---

## Project goal

A personal packing list generator for one, possibly two, users. Stores all items the owner might want to pack, each with conditions for inclusion. Generates a trip-specific list based on trip settings. Maintains history of past trips. Mobile-first.

**Not** a public/multi-tenant app. Two users max for the foreseeable future.

---

## Stack

- **Framework:** SvelteKit (recommended). Smaller bundle, less boilerplate than React/Next.js, file-based API routes built in. Next.js is an acceptable alternative if React experience is preferred.
- **Database:** MySQL (provided by Hostinger plan)
- **Hosting:** Hostinger Node hosting (supports Node + MySQL on current plan)
- **Auth:** Handled by Hostinger at the hosting layer — app does NOT implement its own auth
- **Source control:** GitHub, Hostinger Git integration for deploys
- **Language for data:** Hebrew only. No English translations in DB. IDs/keys are English slugs for code stability.

---

## Source data

The owner maintains a packing spreadsheet (kept outside the repo) with ~18 sheets. Each Hebrew tab name is effectively a trip template — examples of the trip types covered: Shabbat stay, single overnight, day trip, week-long trip, long-distance trail hike, course/retreat, hotel stay, hotel weekend, trip abroad, organized group trip abroad, extended institutional stays, plus a couple of scratch/working tabs.

**Weight the five most recently updated tabs heavily** when picking defaults (they reflect the most up-to-date thinking): the abroad, Shabbat, hotel, day-trip, and extended-stay tabs. Other tabs still contribute their unique items but don't override defaults. Scratch tabs are supplemental only.

Patterns observed in the source data:
- Quantities baked into item names ("3 short-sleeve shirts", "8 pairs of underwear", "15 pairs of socks")
- Same item appears across templates with different quantities → depends on trip length, laundry availability
- Sub-bag organization is consistent: small bag (daypack/carry-on), main bag, suitcase, backpack compartments (bottom/main/top)
- Items split into sub-contexts within each template: night clothes, day clothes, sports, Shabbat, underwear, hygiene, electronics, first-aid, general
- Mutually-exclusive variants exist ("fleece jacket / rain jacket / down jacket")

---

## Core concepts

### Trip
A planned packing event: name, start/end dates, destination, optional template origin, active *layers*, parameters.

### Layer
A contextual mode that activates a group of items. Layers stack — a trip can be "base + hygiene + shabbat + cooking + hiking" simultaneously.

**Final layer list** (derived from spreadsheet analysis; generic slugs shown):

- `base` — items in everything (wallet, phone charger, flip-flops, ...)
- `sleeping` — overnight items (night clothes)
- `hygiene_basic` — short trips
- `hygiene_full` — longer trips
- `electronics_basic` — phone charger
- `electronics_extended` — multiple cables, splitter, speakers, streaming stick
- `first_aid_basic` — band-aids, painkillers
- `first_aid_full` — full kit
- `shabbat` — Shabbat clothes/items (auto-activated when trip overlaps Shabbat)
- `hiking` — hiking-specific gear
- `cooking` — cooking gear
- `swimming` — pool/sea
- `diving` — diving gear (subset of swimming)
- `abroad` — passport, foreign currency, documents folder, plug adapter
- `cold_weather` — winter coat, thermals, gloves, wool hat
- `hot_weather` — sun hat, extra sunscreen
- `rain` — umbrella, rain jacket
- `hotel` — items for hotel stays
- `uniform` — uniform items for institutional stays
- `civilian` — civilian clothes during institutional stays
- `long_trip` — multi-week
- `study` — books and learning materials

*(In the implemented parameter model these were regrouped into accommodation / environment / day-plan categories — see DESIGN.md §3.5.)*

### Item
A packable thing. Fields: Hebrew name, category, default bag, default layer membership, condition expression, quantity formula, shared/personal flag, kit flag and components.

### Template
A saved combination of layers + default parameters. The spreadsheet tabs become templates. Creating a trip from a template activates those layers as defaults; user can adjust.

### Kit
An item whose `kit_contents` lists component items. The kit is one packable unit; rules apply to the kit as a whole (NOT to individual components — component rules out of scope for v1). Components appear when the kit row is expanded. Each component has its own check state. Example: a first-aid kit appears as one row; tap to expand and see/check off contents.

### Trip item
Generated row joining a trip to an item: count, check state, bag distribution, notes, flags for tracking user edits.

---

## Decisions locked in

### Quantities
- Underwear, socks, undershirts: `per_day` (1/day, since no laundry)
- Short/long sleeve shirts: `per_n_days` n=2
- Pants: `per_n_days` n=3 or 4
- Sleepwear: `fixed: 1`
- Hygiene items: `fixed: 1`
- Shabbat items: `fixed: 1` (one set per Shabbat overlap)
- Towels: `fixed: 1` (or 2 for hotel/pool)
- Electronics: `fixed` per spreadsheet (1 charger, 2 cables, etc.)
- Cooking/diving/swimming gear: `fixed: 1`

When unsure during seed generation, flag with `# REVIEW:` in YAML and ask the user.

### Laundry
**Assume none for v1.** Counts scale with trip length. User adjusts with +/- controls in UI after generation if they want fewer.

### Shared vs personal items
Defaults:
- **Shared:** cooking gear, gas canister, tent, first-aid kit (whole kit), card games, speakers, chargers (wall), maps, documents, shared snacks
- **Personal:** clothes, toiletries, towels, phone accessories, cables (per the spreadsheet showing "2 cables" = one per person)

The joint-list feature (one shared item across the household) is **future**, but the `is_shared` flag is added now to avoid migration later.

### Sub-bag organization
**Handle from v1.** Reasoning: simpler to design in now than retrofit.

- Each item has a `default_bag` field (`small_bag`, `main_bag`, `suitcase`, `backpack_top`, `backpack_main`, `backpack_bottom`, etc.)
- Each `trip_items` row has optional `bag_distribution` JSON, e.g. `{"small_bag": 1, "main_bag": 2}` to support count-splitting (1 shirt in the daypack, others in the main bag)
- UI default: flat list view. Toggle button "Split by bag" reorganizes into bag groups.

### Regeneration safety (CRITICAL)

When the user edits trip settings and regenerates, the app must NOT silently destroy: count edits, check marks, manual items, bag distribution, per-item notes.

**Approach (Option B):** Show confirmation diff before destructive changes.

On regeneration:
1. Compute new generated list from current trip context
2. Compare against existing `trip_items`
3. For items the new rules still include AND user hasn't edited count → update count to new rule value
4. For items the new rules still include AND user HAS edited count → keep user's count
5. For items the new rules now include that didn't exist before → insert as new rows
6. For manual items (`is_manual=true`) → never touched
7. For items the new rules no longer include → present as confirmation: "Regenerating will remove N items, M of which you've checked. Confirm?"
   - If yes: delete those rows
   - If no: abort regeneration

API returns the diff first; UI shows confirmation; second call commits.

### Kits
- Modeled as one item with `is_kit=true` and a `kit_contents` array
- Kit appears as ONE row in the packing list
- Tap to expand → shows component items with individual checkboxes
- Rules apply to the kit as a whole, NOT components (fixed contents in v1)
- Kit component check state stored in the `trip_kit_components` table

### Tasks (pre-trip to-dos)
Things like "swap the SIM", "replace the phone screen protector", "get a haircut!", "print insurance details" are pre-trip tasks, not pack-items.

**Out of scope for v1.** Separate feature later, separate table. Do NOT include them in the items catalog.

### Shopping list
Items to buy before the trip (a "shopping" column in one of the tabs). Out of scope for v1. Future feature.

### Optional items
Items marked with "?" in source data are treated as regular items for v1. No priority/confidence level yet. Future feature. *(Superseded: DESIGN.md promoted optional items to a real concept with distinct styling and a separate counter.)*

### Mutually-exclusive variants
"Fleece jacket / rain jacket / down jacket" — three jackets, weather-dependent. For v1, model as separate items with different layer conditions (fleece in `cold_weather`, rain jacket in `rain`, down in `cold_weather` + long-trip). User picks manually if multiple match. No "pick-one" group construct in v1.

### Auth
NOT handled by app. Hostinger provides auth at the hosting layer. App assumes authenticated requests. No users table for v1.

### Offline support
Not in v1.

---

## Database schema (MySQL)

*(Historical draft — the canonical DDL lives in `schema.sql`, where `name_he` shipped as `display_name`, items gained `is_optional`, and a `parameters` table was added.)*

```sql
-- Master catalog
CREATE TABLE items (
  id              VARCHAR(64) PRIMARY KEY,
  name_he         VARCHAR(255) NOT NULL,
  category        VARCHAR(64),
  default_bag     VARCHAR(64),
  is_shared       BOOLEAN DEFAULT FALSE,
  is_kit          BOOLEAN DEFAULT FALSE,
  kit_contents    JSON,
  condition       JSON NOT NULL,
  quantity        JSON NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Templates
CREATE TABLE templates (
  id              VARCHAR(64) PRIMARY KEY,
  name_he         VARCHAR(255) NOT NULL,
  layers          JSON NOT NULL,
  default_params  JSON,
  sort_order      INT DEFAULT 0
);

-- Trips
CREATE TABLE trips (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  template_id     VARCHAR(64),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  destination     VARCHAR(255),
  context         JSON NOT NULL,
  travelers       JSON,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

-- Generated trip items
CREATE TABLE trip_items (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  trip_id           INT NOT NULL,
  item_id           VARCHAR(64) NOT NULL,
  count             INT NOT NULL,
  is_checked        BOOLEAN DEFAULT FALSE,
  is_manual         BOOLEAN DEFAULT FALSE,
  bag_distribution  JSON,
  notes             TEXT,
  count_was_edited  BOOLEAN DEFAULT FALSE,
  rule_snapshot     JSON,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  UNIQUE KEY trip_item_unique (trip_id, item_id)
);

-- Kit component check state per trip
CREATE TABLE trip_kit_components (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  trip_id         INT NOT NULL,
  kit_item_id     VARCHAR(64) NOT NULL,
  component_id    VARCHAR(64) NOT NULL,
  is_checked      BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  UNIQUE KEY kit_comp_unique (trip_id, kit_item_id, component_id)
);
```

---

## Condition expression DSL

Stored as JSON, evaluated by a small (~50 line) evaluator.

**Operators:**
```
true                                          // always include
"layer_name"                                  // include if layer active
{"and": [...]}                                // all must be true
{"or": [...]}                                 // any must be true
{"not": cond}                                 // negation
{"eq": ["param.path", value]}                 // param equals value
{"gte": ["param.path", value]}                // param >= value
{"any_layer": ["a", "b"]}                     // shortcut: any layer active
{"all_layers": ["a", "b"]}                    // shortcut: all layers active
{"includes_shabbat": true}                    // derived from dates (Friday sunset to Saturday night overlap)
```

*(Implemented as `any_param`/`all_params` after the layers→parameters rename.)*

**Examples:**
```json
// Always include
{"condition": true}

// Cooking pot: hiking AND cooking
{"condition": {"all_layers": ["hiking", "cooking"]}}

// Shabbat candles: trip overlaps Shabbat
{"condition": {"includes_shabbat": true}}

// Swim gear: pool OR sea
{"condition": {"any_layer": ["swimming", "diving"]}}

// Passport: abroad only
{"condition": "abroad"}

// Winter coat: cold weather
{"condition": "cold_weather"}
```

---

## Quantity formula DSL

```
{"fixed": N}                                  // always N
{"per_day": N}                                // N per trip day
{"per_n_days": {"n": N, "min": M}}            // ceil(days/N), at least M
{"per_weekday": N}                            // N per weekday in trip
{"per_shabbat": N}                            // N per Shabbat overlap
{"days_plus": {"add": N, "min": M}}           // days + N, minimum M
```

The evaluator computes a number from formula + trip parameters. That number becomes the initial `count` on the trip_items row.

---

## Derived trip parameters

The rules engine receives the trip context PLUS these derived values:

- `days` — number of days (end_date - start_date + 1)
- `weekdays` — count of weekday days in the trip (Sun-Thu, Israeli week)
- `weekends` — count of weekend days (Fri-Sat)
- `has_shabbat` — true if Friday sunset to Saturday night falls within trip
- `shabbat_count` — how many Shabbats overlap
- `has_holiday` — placeholder for future (Hebrew calendar integration)

---

## Rules engine flow

```
generate(trip):
  active_layers = trip.context.layers
  params = trip.context.params + derived(trip.start, trip.end)

  results = []
  for item in items:
    if evaluate(item.condition, active_layers, params):
      count = compute_quantity(item.quantity, params)
      results.append({item_id, count, rule_snapshot: {condition, quantity}})
  return results

merge_into_trip(trip_id, generated_items):
  existing = trip_items WHERE trip_id = trip_id
  diff = {added: [], updated: [], to_be_removed: []}

  for new_item in generated_items:
    if new_item.id in existing:
      existing_row = existing[new_item.id]
      if existing_row.is_manual:
        continue  // never touch manual items
      if not existing_row.count_was_edited:
        existing_row.count = new_item.count
      existing_row.rule_snapshot = new_item.rule_snapshot
      diff.updated.append(existing_row)
    else:
      insert new row with is_manual=false, count_was_edited=false
      diff.added.append(new_item)

  for existing_row in existing:
    if existing_row.is_manual:
      continue
    if existing_row.item_id not in generated_items:
      diff.to_be_removed.append(existing_row)

  return diff  // UI confirms before deleting to_be_removed
```

---

## API surface

All endpoints assume authentication is handled by the Hostinger layer.

```
GET    /api/items                          list catalog
POST   /api/items                          create custom item
PATCH  /api/items/:id                      edit item (catalog-level)
DELETE /api/items/:id

GET    /api/templates                      list templates
GET    /api/templates/:id

GET    /api/trips                          list all trips (sorted by date)
POST   /api/trips                          create trip (from template or blank)
GET    /api/trips/:id                      get trip + items + kit components
PATCH  /api/trips/:id                      update settings, returns regen diff
POST   /api/trips/:id/regenerate           commit regeneration (after diff confirm)
DELETE /api/trips/:id

POST   /api/trips/:id/items                add manual item to trip
PATCH  /api/trips/:id/items/:itemId        update count / bag / check / notes
DELETE /api/trips/:id/items/:itemId        remove (manual items only)

POST   /api/trips/:id/items/:itemId/components/:cid    toggle kit component check
```

**PATCH /api/trips/:id behavior:**
- Updates trip settings (layers, params, dates, name, destination)
- Computes regeneration diff
- Returns `{trip: {...}, diff: {added: [...], updated: [...], to_be_removed: [...]}}`
- Does NOT delete `to_be_removed` items — that requires a second call to `POST /api/trips/:id/regenerate` with confirmation
- The "added" and "updated" items ARE applied immediately (safe operations)

---

## Frontend structure (SvelteKit)

```
/                                trips list (past + upcoming)
/trips/new                       trip creation form (template picker → params form)
/trips/[id]                      packing list main view
/trips/[id]/settings             edit settings (triggers regen diff modal)
/items                           catalog browser/editor
/templates                       template viewer (read-only for v1)
```

**Main packing list view (`/trips/[id]`):**
- Header: trip name, dates, active layer chips
- Top bar buttons: "Filter by bag", "Add item", "Edit settings"
- List rows:
  - Checkbox (toggles `is_checked`)
  - Hebrew name (RTL layout throughout the app)
  - Count with - / + buttons
  - For kits: expand arrow to show sub-components
  - Three-dot menu: split between bags, edit notes, delete (manual only)
- Bottom: "+ Add manual item" floating button

**RTL:** Whole app is RTL. Use `dir="rtl"` at the document level. Numbers/counts can stay LTR but item names are Hebrew.

---

## Deployment

1. Push to GitHub
2. Hostinger Git integration: connect repo, set deploy branch (probably `main`)
3. Hostinger panel: configure Node app — entry point, env vars for MySQL credentials (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`)
4. Hostinger runs `npm install && npm run build && npm start`
5. MySQL database created via Hostinger panel; connection details go in env vars
6. Domain/subdomain points to the Node app
7. HTTPS automatic via Hostinger
8. For seed updates: edit YAMLs, push, run the seeder via SSH (or build a protected `/api/admin/reseed` endpoint)

---

## Pending work at handoff time (historical — all of this shipped; see CLAUDE.md checklist)

1. **Items YAML** — full ~250-item catalog extracted from the source spreadsheet. Hebrew names preserved (in the gitignored personal seed). Each item with:
   - `id` (English slug)
   - Hebrew display name
   - `category`
   - `default_bag`
   - `is_shared`
   - `is_kit` + `kit_contents` if applicable
   - `condition`
   - `quantity`
   - `notes` (from spreadsheet comments)

   Items where the quantity or layer is uncertain should be flagged with `# REVIEW:` comments for user review before import.

   **Use the five most recent tabs as the primary source.** Other tabs supply unique items but don't override defaults.

2. **Templates YAML** — one template per spreadsheet tab (trip-type slugs; a couple of tabs may be sub-templates/kits rather than full templates — decide while building; scratch tabs skipped).

3. **`schema.sql`** — DDL above, ready to run.

4. **Rules-engine and API docs** with examples and edge cases.

5. **The SvelteKit app** — once the above are reviewed and approved.

---

## Key principles for Claude Code to follow

1. **Hebrew everywhere in the UI.** RTL layout. No English visible to the user except numbers.
2. **Never destroy user edits silently.** Regeneration must surface a diff and confirm before deletion.
3. **YAML-first iteration.** The user reviews and edits the items/templates YAML before any DB seeding. Treat them as the source of truth, with the DB as a derived index.
4. **Mobile-first.** Touch targets, large checkboxes, swipe-friendly. Test in a narrow viewport.
5. **Two users max.** Don't over-engineer for scale. SQLite-style simplicity in MySQL.
6. **Single-repo monolith.** SvelteKit frontend + API routes + DB access all in one codebase, deployed as one Node app.
7. **The five recent tabs are the source of truth** for default quantities and item naming when conflicts exist.

---

## Open questions for the user (during build)

When generating the items YAML, flag and ask about:

1. Exact `per_n_days` values for shirts/pants when the spreadsheet shows inconsistent quantities
2. Items appearing only in one obscure tab — keep or skip?
3. Kit composition boundaries (where does the first-aid kit end and individual items begin?)
4. Bag assignment for items whose spreadsheet location is ambiguous
5. Whether multi-variant items (jackets, towels) should be one item with conditions or separate items

---

## Out of scope for v1 (future features)

- Pre-trip tasks list (separate feature, separate table)
- Shopping list
- Optional/priority levels on items *(partially superseded — optional items got UI treatment in DESIGN.md)*
- Joint lists (one shared item across the household) — flag exists, UI doesn't
- Weight tracking
- Offline support
- Authentication (Hostinger handles it)
- Mutually-exclusive item groups ("pick one of these jackets")
- Conditional kit contents
- Weather API integration (climate is a manual parameter)
- Hebrew calendar / holiday detection (only Shabbat for v1)
- Multi-language (Hebrew only)
- Item search/filter in catalog browser *(superseded — shipped in phase 3)*
- Trip sharing / export to text
