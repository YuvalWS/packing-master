# DESIGN.md — Packing List Generator UI/UX

This is the visual and interaction design spec. It is intended for review and discussion **before** implementation begins. Wireframes are ASCII; labels are shown in English here for documentation purposes — **the production UI is entirely Hebrew**, with every string sourced from `src/lib/strings.json`. Layout is RTL: within each row content reads right-to-left, but the boxes themselves still flow top-to-bottom.

For the product spec (data model, DSL, API), see [context.md](context.md). **Where DESIGN.md and context.md disagree, DESIGN.md wins** — notably:

- "Layers" → renamed to **"parameters"** (UI prompt: *"What's the plan?"*), grouped into three categories: **accommodation** (pick one), **environment** (multi), **day plans** (multi). See §3.5.
- Items catalog editing is **read-only in phase 1**. Phase 2 plan in §10.
- Optional items (`?` in source data) are a real concept now — see §4.3 and §10.

---

## 1. Design principles

1. **Mobile-first.** The user packs while standing next to a suitcase, holding the phone. Touch targets ≥44px. No hover-only affordances. Tested at 360×640 first, then desktop.
2. **Hebrew & RTL throughout.** `dir="rtl"` on `<html>`. All chrome (buttons, labels, status) is Hebrew. Numbers stay LTR inside otherwise-RTL lines.
3. **Cognitive minimum.** A trip page should show the list, full stop. Settings, filters, and editing tools are one tap away — never visible by default.
4. **Never destroy work silently.** Any regeneration that would delete user-edited rows surfaces a diff modal with the exact items and counts at stake.
5. **Generous whitespace, clear hit targets, big checkboxes.** This is a single-purpose phone app, not a dense desktop tool.
6. **One floating action per screen at most.** No competing FABs.

## 2. Visual language

### Typography

- **Body:** system font stack with Hebrew fallback — `'Heebo', 'Assistant', system-ui, -apple-system, sans-serif`. Heebo if a webfont is acceptable; otherwise system.
- **Sizes:** 16px base, 18px for list rows, 24px for screen titles, 14px for meta.
- **Line height:** 1.5 minimum (Hebrew vowels & diacritics need room).

### Color (light theme; dark theme as enhancement)

| Token              | Hex       | Use                                  |
|--------------------|-----------|--------------------------------------|
| `bg`               | `#fafafa` | Page background                      |
| `surface`          | `#ffffff` | Cards, rows                          |
| `text`             | `#111827` | Primary text                         |
| `text-muted`       | `#6b7280` | Meta, hints                          |
| `border`           | `#e5e7eb` | Row dividers, input borders          |
| `primary`          | `#2563eb` | Primary action, active state         |
| `primary-soft`     | `#dbeafe` | Active chip background, selection    |
| `success`          | `#16a34a` | Checked-off rows (subtle tint)       |
| `warning`          | `#d97706` | "Regenerate will remove N items"     |
| `danger`           | `#dc2626` | Destructive confirmations            |

Checked rows: soft success tint on background + strikethrough on name + muted color. Not green text.

### Spacing & layout

- 8px spacing unit. Common values: 8, 12, 16, 24, 32, 48.
- Max content width on desktop: 720px, centered.
- Bottom safe area: 96px padding so FAB doesn't cover the last row.

### Iconography

Use a small set from a single icon library (Lucide). Required icons: check, plus, minus, settings (gear), chevron-down, more-horizontal (three-dot menu), bag, filter, calendar, trash, edit (pencil), x (close), warning-triangle.

### RTL behavior

- Chevrons & directional arrows mirror: "back" arrow points right, expand chevron points left when collapsed (pointing into the row's content direction).
- Counts and dates stay LTR with `unicode-bidi: isolate` or `dir="ltr"` on the inner span.
- Use CSS logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`) so no per-direction CSS is needed.
- **CSS transforms are NOT direction-aware.** An element positioned with `inset-inline-start: 50%` needs `translateX(+50%)` to center in RTL (the property resolves to `right`), not `-50%`. See `Modal.svelte` for the canonical pattern.

---

## 3. Information architecture & navigation

```
┌─────────────────────────────────────────┐
│ Top app bar (sticky)                    │
│  ☰   Trips                          ⚙   │   ← hamburger (start side; in RTL that's the right), title, settings
├─────────────────────────────────────────┤
│                                          │
│   <screen content>                       │
│                                          │
└─────────────────────────────────────────┘
```

**Navigation drawer (hamburger):**

- Trips — home
- Items (catalog)
- Templates
- App settings — empty for v1, placeholder

No bottom tab bar (would compete with FABs and only has 3 destinations). Drawer is fine for a personal app accessed daily. At ≥960px the drawer becomes a permanent sidebar.

**Routes:**

| Path                         | Screen                                |
|------------------------------|---------------------------------------|
| `/`                          | Trips list                            |
| `/trips/new`                 | New trip — template picker → params   |
| `/trips/[id]`                | Packing list (main view)              |
| `/trips/[id]/settings`       | Edit trip parameters                  |
| `/items`                     | Items catalog (**read-only v1**)      |
| `/items/[id]`                | Item detail (**read-only v1**)        |
| `/templates`                 | Templates list (**read-only v1**)     |
| `/templates/[id]`            | Template detail (**read-only v1**)    |

### 3.5 The parameter model (replaces "layers")

A trip's content is driven by **parameters** the user picks under the question *"What's the plan?"*. The engine sees a flat set of active parameter IDs; the UI groups them into three categories for selection ergonomics:

| Category         | Selection      | Examples (generic; the real catalog lives in the user's `seed/local/parameters.yaml` with Hebrew labels) |
|------------------|---------------|----------------------------------------------------------------------------------------------------------|
| **accommodation** | exactly one   | `accommodation_hotel`, `accommodation_hostel` (hostel / Airbnb), `accommodation_outdoor` (camping), `accommodation_dorm`, `accommodation_friends` (staying with someone) |
| **environment**   | multi-select  | `env_cold`, `env_hot`, `env_rain`, `env_abroad`                                                          |
| **day_plans**     | multi-select  | `plan_hiking`, `plan_swimming`, `plan_diving`, `plan_cooking`, `plan_sightseeing`, `plan_workshop`       |

**Derived parameters** (auto-added by the engine, not shown as user toggles):

- `derived_has_shabbat` — trip overlaps Friday sunset → Saturday night
- `derived_long_trip` — trip ≥ 14 days
- `derived_short_trip` — trip ≤ 2 days
- (future) `derived_has_holiday`

**Engine view:** active parameter set, e.g. `["accommodation_outdoor", "env_cold", "env_rain", "plan_hiking", "plan_cooking", "derived_has_shabbat"]`. Conditions on items reference these directly via the existing DSL — `any_layer`/`all_layers` operators are renamed `any_param`/`all_params`. No structural complexity added; only UI presentation differs.

**Singleton enforcement:** the engine validates that exactly one `accommodation_*` is in the active set; the UI uses radio buttons to make this mechanical.

The full parameter catalog lives in the seed YAML (`seed/sample/parameters.yaml` committed as a generic reference; `seed/local/parameters.yaml` gitignored with the real ids and Hebrew labels) so the user can edit labels/categories without touching code.

---

## 4. Screens

All labels below appear in English for documentation; the real UI renders the Hebrew equivalents from `strings.json`.

### 4.1 Trips list — `/`

The home screen. Shows upcoming first, then past, separated by a divider.

```
┌─────────────────────────────────────────┐
│ ☰     Trips                         ⚙  │
├─────────────────────────────────────────┤
│                                         │
│  UPCOMING                               │
│  ┌─────────────────────────────────┐   │
│  │ Rome — May                       │   │
│  │ 22/05/2026 – 29/05/2026 · 8 days │   │
│  │ [Hotel] [Abroad] [+2]            │   │   ← param chips
│  │                         47 items │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ June camping weekend             │   │
│  │ 12/06/2026 – 14/06/2026 · 3 days │   │
│  │ [Camping] [Hiking]               │   │
│  │                         12 items │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ────────────────────────────────────   │
│  PAST                                   │
│  ┌─────────────────────────────────┐   │
│  │ Shabbat by the sea (April)       │   │
│  │ 03/04/2026 – 05/04/2026          │   │
│  │ ✓ Completed                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│                                  ┌────┐ │
│                                  │ +  │ │ ← FAB → /trips/new
│                                  └────┘ │
└─────────────────────────────────────────┘
```

**States:**
- **Empty:** large illustration / icon + "No trips yet. Create your first trip." + primary button "Create trip".
- **Loading:** 3 skeleton cards.
- **Error:** retry button + message in Hebrew.

**Interactions:**
- Tap card → `/trips/[id]`
- Long-press card → context menu: duplicate, delete, export (export deferred). Long-press only; no swipe (collision with phone gestures).
- FAB → `/trips/new`.

### 4.2 New trip — `/trips/new`

Two-step flow. Step 1 = template, Step 2 = parameters. Stepper at top.

**Step 1 — pick template (or blank):**

```
┌─────────────────────────────────────────┐
│  →  New trip                            │   ← back chevron points right (RTL "back")
├─────────────────────────────────────────┤
│  Step 1 of 2 · Pick a template          │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Abroad  │ │ Shabbat │ │ Hotel   │   │   ← the "recent" templates surfaced first
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐               │
│  │ Hiking  │ │ Base    │               │
│  └─────────┘ └─────────┘               │
│                                         │
│  All templates                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ ...     │ │ ...     │ │ ...     │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ... (all remaining)                    │
│                                         │
│  ─── or ───                             │
│  [    Start from a blank trip    ]      │   ← secondary, full width
└─────────────────────────────────────────┘
```

Tap a template card → advance to step 2 with that template's parameters pre-checked.

**Step 2 — "What's the plan?"**

```
┌─────────────────────────────────────────┐
│  →  New trip                            │
├─────────────────────────────────────────┤
│  Step 2 of 2 · What's the plan?         │
│                                         │
│  Trip name (optional)                   │
│  ┌─────────────────────────────────┐   │
│  │ Rome May                         │   │   ← placeholder shows the default: "8 days at a hotel"
│  └─────────────────────────────────┘   │   ← if empty on save → "{days} days at {accommodation}"
│                                         │
│  Dates                                  │
│  ┌──────────┐    ┌──────────┐          │
│  │ 22/05/26 │ →  │ 29/05/26 │          │
│  └──────────┘    └──────────┘          │
│  8 days · includes one Shabbat          │   ← derived live (informational)
│                                         │
│  Destination (optional)                 │
│  ┌─────────────────────────────────┐   │
│  │                                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ── Accommodation ─────────────────     │
│  ◯ Hotel        ● Hostel / Airbnb       │   ← radio, pick exactly one
│  ◯ Camping      ◯ Dorm                  │
│  ◯ With friends                         │
│                                         │
│  ── Environment ──────────────────      │
│  ☐ Cold         ☐ Hot                   │   ← multi-select chip toggles
│  ☐ Rain         ☑ Abroad                │
│                                         │
│  ── Day plans ────────────────────      │
│  ☑ Hiking       ☐ Swimming              │
│  ☐ Diving       ☐ Cooking               │
│  ☐ Sightseeing  ☐ Workshop              │
│                                         │
│  ── Automatic ────────────────────      │
│  ✓ Shabbat      (detected from dates)   │   ← derived, read-only display
│                                         │
│  ┌─────────────────────────────────┐   │
│  │       Create list                │   │   ← primary, full width, sticky bottom
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- **Trip name is optional.** Placeholder text shows the auto-default: `{days} days at {accommodation}` (e.g. "8 days at a hotel", "3 days camping"). If the field is empty on save, that string is stored as the name. If accommodation isn't picked yet, the placeholder reads "Trip".
- **Accommodation** is a radio group; one and only one always selected. If the user picked a template, the template's accommodation is pre-selected.
- **Environment** and **Day plans** are multi-select chip toggles. The template seeds defaults; user freely adjusts.
- **Derived parameters** (auto-detected) appear in a read-only "Automatic" section so the user sees that Shabbat (etc.) is being applied without thinking it's a clickable toggle.
- All category sections are visible by default — no collapsing — because the full set is short enough to fit on a phone screen.
- "Create list" → POST `/api/trips` → redirect to `/trips/[id]`.

### 4.3 Packing list — `/trips/[id]` (the main screen)

This is where the user spends most of their time. Optimize aggressively.

**Default view (flat list, grouped by category):**

```
┌─────────────────────────────────────────┐
│  →  Rome May                   ⋯         │
│  22/05 – 29/05 · 8 days · one Shabbat   │
│  [Hotel] [Abroad] [Hiking] [+2 ▾]       │   ← param chips; tap ▾ to expand all
├─────────────────────────────────────────┤
│  [🛍 By bag]  [🔍]    0/41  (+ 6 opt.)  │   ← required progress · optional count
│  [⇣ Checked to bottom]                  │   ← toggle: move checked items to bottom
├─────────────────────────────────────────┤
│  Clothes                                │
│  ┌─────────────────────────────────┐   │
│  │ ☐  Short-sleeve shirts   [-] 4 [+]│   │
│  ├─────────────────────────────────┤   │
│  │ ☐  Underwear             [-] 8 [+]│   │
│  ├─────────────────────────────────┤   │
│  │ ⌑  Sun hat · optional    [-] 1 [+]│   │   ← optional: dashed checkbox + "optional" tag
│  ├─────────────────────────────────┤   │
│  │ ☑  ~~Wool hat~~          [-] 1 [+]│   │   ← checked: strikethrough + tint
│  └─────────────────────────────────┘   │
│                                         │
│  Hygiene                                │
│  ┌─────────────────────────────────┐   │
│  │ ☐  ▸ First-aid kit        1     │   │   ← kit: chevron to expand
│  ├─────────────────────────────────┤   │
│  │ ☐  Toothpaste             1     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Electronics                            │
│  ┌─────────────────────────────────┐   │
│  │ ☐  Phone charger          1     │   │
│  └─────────────────────────────────┘   │
│                                         │
│                                  ┌────┐ │
│                                  │ +  │ │   ← FAB → add manual item
│                                  └────┘ │
└─────────────────────────────────────────┘
```

**Row anatomy:**

```
☐  [name]                  [-] N [+]  ⋯
│   │                        │      │
│   │                        │      └─ three-dot menu: split between bags, note, delete (manual only)
│   │                        └─ count stepper, LTR
│   └─ Hebrew name, with an "optional" pill if the item is optional
└─ checkbox (large, 28px)
```

- **Kit row:** has a `▸` chevron before the name. Tap chevron OR row body → expand inline (animated max-height) to reveal component sub-rows, indented 24px, each with its own checkbox. Tapping the kit's main checkbox checks the whole kit at once (and all components). Component checks roll up: kit shows partial state (square inside checkbox) if some components checked.
- **Manual items** show a small badge before the name so the user can tell at a glance which ones aren't from rules.
- **Edited count** (user manually changed) shows a tiny dot indicator next to the count so future regeneration warnings make sense.

**Top action bar buttons:**
- `🛍 By bag` — toggles between "by category" (default) and "by bag" grouping. When active, button highlighted; rows regroup under daypack / main bag / suitcase / etc. **Default is by-category** and the choice does not persist per trip in the DB.
- `🔍` — opens an inline search input (filters list as user types).
- `0/41  (+ 6 optional)` — **required-items** progress counter is primary (checked / required total). The parenthesized "+ N optional" is the count of optional items still unchecked. Tap counter → cycles between *all*, *only required unchecked*, *only optional unchecked*.
- `⇣ Checked to bottom` — **sort toggle**: when on, checked items animate to the bottom of their category group and stay there. Off by default. Choice is per-trip in `localStorage` for that trip id (no DB round-trip needed).
- **Param chips** show first 3 + "+N ▾". Tapping the `+N ▾` chip expands the row to show all active params (one-tap to collapse).
- `⋯` in title bar — trip-level menu: duplicate, export to text (post-v1), delete trip.

**Optional items** (`?` flag in catalog) — visual treatment:
- Dashed checkbox border.
- "Optional" pill after the name.
- Excluded from the main `N/M` counter; appear in a secondary `(+ K optional)` counter.
- When checked, they still get the strikethrough + tint and the counter updates.

**Three-dot menu per row** (bottom sheet on mobile):
- `Split between bags` → opens bag-distribution sub-modal: shows current count and allows the user to assign integers per bag (validates total = count).
- `Note` → opens text-area modal for a free-form note attached to the trip_item.
- `Delete` → only enabled for `is_manual=true` rows. Confirms before delete.

**"By bag" view variant:**

```
│  Daypack                                │
│  ┌─────────────────────────────────┐   │
│  │ ☐  Phone charger          1     │   │
│  │ ☐  Wallet                 1     │   │
│  └─────────────────────────────────┘   │
│  Main bag                               │
│  ┌─────────────────────────────────┐   │
│  │ ☐  Short-sleeve shirts    4     │   │
│  ...                                    │
```

Items with split distribution appear in multiple groups with their per-bag count.

**Empty / loading / error:**
- **Empty trip** (no rules matched, unlikely): "No items were generated. Check the active parameters." + button to settings.
- **Loading:** skeleton with category headers + 3 rows each.
- **Network error on toggle:** keep optimistic UI, toast at bottom "Failed to save. Try again." with retry.

**Add-manual-item flow (FAB):**

Bottom sheet:
```
┌─────────────────────────────────────────┐
│  Add item                               │
│                                         │
│  Search the catalog                     │
│  ┌─────────────────────────────────┐   │
│  │ Type an item name...             │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ▸ Book                           │   │   ← search results
│  │ ▸ Notebook                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─── or ───                             │
│  [    Add a free-text item     ]        │   ← creates is_manual=true row not in catalog
└─────────────────────────────────────────┘
```

### 4.4 Trip settings — `/trips/[id]/settings`

Same form as new-trip step 2, but:
- Shows current values.
- Save button reads "Update and check changes".
- On save: PATCH `/api/trips/:id`, server returns `{trip, diff}`, UI immediately opens the **regen diff modal** (4.5).

### 4.5 Regen diff modal (critical safety screen)

Appears after settings save (or after an explicit "Regenerate" action in the trip menu).

```
┌─────────────────────────────────────────┐
│  List changes                       ✕   │
├─────────────────────────────────────────┤
│  The settings change affects the list:  │
│                                         │
│  ✚ 3 items added                        │
│   • Down coat             2             │
│   • Gloves                1             │
│   • Wool hat              1             │
│                                         │
│  ↻ 5 items updated                      │
│   • Short-sleeve shirts   4 → 6         │
│   • Underwear             8 → 10        │
│   • Charger               1 (no change) │
│   ...                                   │
│                                         │
│  ⚠ 4 items will be removed              │
│  ┌─────────────────────────────────┐   │
│  │ • Flip-flops       ✓ checked     │   │   ← warn on checked items
│  │ • Swimsuit         ✓ checked     │   │
│  │ • Sunscreen                      │   │
│  │ • Sunglasses                     │   │
│  └─────────────────────────────────┘   │
│  2 of these you already checked off.    │
│                                         │
│  [ Cancel ]        [ Confirm & update ] │   ← danger color on confirm
└─────────────────────────────────────────┘
```

- **Added** items already exist server-side (PATCH applied them — safe).
- **Updated** items: counts already updated where the user hadn't edited; rows the user had edited show "(kept manual count: N)" instead.
- **To-be-removed**: NOT removed yet. User must press "Confirm & update" → triggers `POST /api/trips/:id/regenerate` which actually deletes them. Otherwise "Cancel" → no delete.
- **No data at risk → no modal.** If `to_be_removed` is empty, the modal is suppressed entirely. The PATCH response is applied and the user lands back on the packing list with a small toast: "List updated · N added · M changed". Only when removal is involved does the diff modal actually open.
- Manual items NEVER appear in this modal — they're invisible to the rules engine.

### 4.6 Items catalog — `/items` (read-only in phase 1)

Browse-only catalog viewer. Editing happens by hand-editing the seed YAML and re-running the seed; the UI editor is **phase 2** (see §10).

```
┌─────────────────────────────────────────┐
│ →  Items (247)                          │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │ 🔍 Search items...               │   │
│  └─────────────────────────────────┘   │
│  Category: [All ▾]  Parameter: [All ▾]  │
├─────────────────────────────────────────┤
│  Clothes                                │
│  ┌─────────────────────────────────┐   │
│  │ Short-sleeve shirts              │   │
│  │ shirt_short · 1 per 2 days       │   │
│  │ Active on every trip             │   │
│  ├─────────────────────────────────┤   │
│  │ Down coat                        │   │
│  │ coat_down · fixed 1              │   │
│  │ Active when: cold                │   │
│  └─────────────────────────────────┘   │
│  ...                                    │
└─────────────────────────────────────────┘
```

Tap row → `/items/[id]` (read-only detail):

```
┌─────────────────────────────────────────┐
│  →  Short-sleeve shirts                 │
├─────────────────────────────────────────┤
│  Name              Short-sleeve shirts  │
│  ID                shirt_short          │
│  Category          Clothes              │
│  Default bag       Main bag             │
│  Shared            No                   │
│  Kit               No                   │
│                                         │
│  Active when                            │
│  ┌─────────────────────────────────┐   │
│  │ On every trip                    │   │   ← human-readable rendering
│  └─────────────────────────────────┘   │
│                                         │
│  Quantity                               │
│  ┌─────────────────────────────────┐   │
│  │ 1 shirt per 2 days (min 1)       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Notes                                  │
│  ┌─────────────────────────────────┐   │
│  │ —                                │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

A small "Source: seed YAML" footer hints at where edits should happen for phase 1.

### 4.7 Templates — `/templates`

Read-only list for v1. Each row → detail page showing the template's default parameters. Edit deferred.

---

## 5. Component inventory

| Component                | Used in                                | Notes |
|--------------------------|----------------------------------------|-------|
| `AppShell`               | All routes                             | Drawer + top bar + safe-area padding |
| `TripCard`               | Trips list                             | Compact card with name/dates/chips/count |
| `ParamChip` / `ParamChipList` | Trips list, trip header, settings | Pill, active state; list truncates to 3 + "+N" |
| `PackingListRow`         | `/trips/[id]`                          | Checkbox + name + stepper + menu |
| `KitComponentRow`        | `/trips/[id]`                          | Nested component rows under a kit |
| `Stepper`                | Multiple                               | LTR `- N +` |
| `BagFilterToggle`        | `/trips/[id]`                          | Toggle button |
| `RegenDiffModal`         | After settings save                    | The critical confirmation modal |
| `BottomSheet`            | Add item, three-dot menu, bag split    | Reusable bottom sheet primitive |
| `RowActionsSheet`        | `/trips/[id]`                          | Per-row menu: bag split / note / delete |
| `EmptyState`             | All list screens                       | Icon + message + CTA |
| `Toast`                  | Global                                 | Bottom-edge transient feedback |

## 6. State & loading model

- **Optimistic UI** for: check/uncheck, count +/-, manual item add. Roll back on server error and show toast.
- **Pessimistic** for: trip create, trip delete, regeneration confirm, item catalog edits, row-menu saves. Show spinner on the button.
- **Skeletons** for initial page loads (trips list, packing list). No spinners on full-page first paint. *(In practice pages are SSR-loaded — see §12 #8.)*

## 7. Accessibility & quality bar

- All interactive elements have visible focus rings (keyboard users + a11y).
- Checkboxes are real `<input type="checkbox">` (or buttons with `role="checkbox"` and `aria-checked`).
- Stepper buttons have aria-labels ("add one" / "remove one" in Hebrew).
- Color contrast ≥ AA (the chosen palette already passes for body text on `#fafafa`).
- `lang="he"` and `dir="rtl"` on `<html>` so screen readers pronounce Hebrew correctly.
- Reduced-motion preference disables expand/collapse animation.
- Modal surfaces (modal, bottom sheet, overlay drawer) trap focus and restore it to the opener on close.

## 8. Out-of-scope visuals (deferred, but noted)

These screens will exist later. Don't design them now, but reserve nav slots:
- Pre-trip tasks list (post-v1)
- Shopping list (post-v1)
- Bag-weight tracking (post-v1)
- Trip export to plain text / share (post-v1)
- ~~Per-traveler split when "joint list" launches~~ — built as multi-person trips, §13

---

## 9. Resolved decisions (was: open questions)

| # | Decision |
|---|----------|
| 1 | Nav: drawer (not bottom tabs). |
| 2 | Color palette: neutral blue-primary (per spec above); revisit later if needed. |
| 3 | By-bag toggle: default off (by-category); not persisted per-trip in DB. Local toggle state via `localStorage` per trip. |
| 4 | Param chips on trip header: show first 3 + "+N ▾", tap to expand all in place. |
| 5 | Optional items (`?`): dashed checkbox + "optional" pill; **excluded from main counter**, counted separately as `+ K optional`. |
| 6 | Regen diff modal: **silent** when no removals — toast only. Modal opens only when something would be deleted. |
| 7 | Manual-item entry: no bag picker in the form; defaults to `main_bag`. User can later change via the three-dot menu. |
| 8 | Font: ship Heebo as webfont. |
| 9 | Param UI shows **Hebrew labels**; engine uses English IDs. The parameters YAML carries both. |
| 10 | Items catalog: **read-only in phase 1**. Editing lives in YAML for now. Phase 2 plan in §10 below. |

## 10. Phase 2 plan — items editor (deferred, do not build yet)

Captured for future phase so we don't lose the design intent. **Do not implement in phase 1.**

### 10.1 Easy mode (default)

Most items only need to say "include me when *these* parameters are active". A flat checkbox list of all parameters covers ~80% of catalog edits without any rule expressions.

```
┌─────────────────────────────────────────┐
│  →  Edit item: Down coat          💾   │
├─────────────────────────────────────────┤
│  Name:      [ Down coat              ]  │
│  Category:  [ Clothes ▾ ]               │
│  Bag:       [ main_bag ▾ ]              │
│  Shared ☐   Optional ☐   Kit ☐          │
│                                         │
│  Quantity:                              │
│  ( ) Fixed: [1]                         │
│  ( ) Per days: 1 per [N] days           │
│  ( ) Per Shabbat: [1] per Shabbat       │
│  ...                                    │
│                                         │
│  ── Inclusion rule ────────────────     │
│  ◉ Simple   ◯ Advanced                  │
│                                         │
│  Include this item when... (check       │
│  parameters):                           │
│                                         │
│  Accommodation:                         │
│  ☐ Hotel   ☐ Hostel   ☑ Camping         │
│  ☐ Dorm    ☐ With friends               │
│                                         │
│  Environment:                           │
│  ☑ Cold    ☐ Hot    ☐ Rain   ☐ Abroad   │
│                                         │
│  Day plans:                             │
│  ☐ Hiking  ☐ Swimming  ☐ Diving  ...    │
│                                         │
│  Logic:                                 │
│  ◉ Any checked is enough (OR)           │
│  ◯ All checked are required (AND)       │
│                                         │
│  Rule preview (human-readable):         │
│  ┌─────────────────────────────────┐   │
│  │ "When accommodation=camping      │   │
│  │  or environment=cold"            │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

The easy-mode UI translates the user's checks into a normal-form condition:

- Per category, the selected parameters form an inner OR.
- Categories combine via the AND/OR toggle at the bottom (default OR).

Examples:
- "Always" → no parameters checked, condition = `true`.
- "When cold or rainy" → `{"any_param": ["env_cold", "env_rain"]}`.
- "When hiking and also cooking" → `{"all_params": ["plan_hiking", "plan_cooking"]}`.

Most existing rules fit; the rest are flagged "advanced condition — edit in advanced mode" and disable the easy form.

### 10.2 Advanced mode — visual block builder (no JSON)

For the residual rules that don't fit easy mode (nested AND/OR, `not`, `eq` on a non-param), a block builder similar to Scratch / Blockly:

```
┌─────────────────────────────────────────┐
│  Advanced rule                          │
│  ┌─────────────────────────────────┐   │
│  │ ⟦AND⟧                            │   │
│  │   ⟦OR⟧                           │   │
│  │     ⟦param active: env_cold⟧     │   │
│  │     ⟦param active: env_rain⟧     │   │
│  │   ⟦NOT⟧                          │   │
│  │     ⟦param active: plan_swimming⟧│   │
│  └─────────────────────────────────┘   │
│  [+ Add block ▾]                        │
└─────────────────────────────────────────┘
```

Blocks correspond 1:1 to DSL operators (`and`, `or`, `not`, `eq`, `gte`, `any_param`, `all_params`, `includes_shabbat`). Drag/click to add, delete via × on each block. Always renders a live preview of the human-readable rule below the canvas.

**Phase 2 status:** easy mode is the minimum; advanced mode can defer to phase 3 if it proves complex. JSON-textarea fallback is acceptable as a temporary stopgap in phase 2 if the advanced builder slips.

### 10.0 Catalog API — the editor's backend (approved and built November 2026)

Approved by the user 2026-11-19 so an AI agent can manage items, rules, templates and parameters before any editor UI exists. The UI editor (10.1/10.2) will call the same endpoints.

**Source of truth flips to the database.** Once an install is live, the catalog in its database is authoritative; the agent and (later) the editor write there. The YAML in `seed/` becomes (a) the bootstrap for a fresh database and (b) an export: `GET /api/catalog` returns the live catalog in the seed shape and `npm run catalog:pull -- <base-url>` writes it to `seed/local/*.yaml`. `extract:excel` is a one-time importer; re-running it after go-live would overwrite exported edits.

**Endpoints** (all validated with the same Zod schemas as the seed files):

| Endpoint | Behaviour |
|---|---|
| `POST /api/items` | Create. 409 `item_exists` if the id is taken (also when archived). |
| `PATCH /api/items/:id` | Partial update; the merged item must validate as a whole. `id` is immutable. `archived: false` un-archives. |
| `DELETE /api/items/:id` | Hard delete when no trip uses the item; otherwise **archive** it (`archived_at`), so past trips keep their rows. Archived items are not generated and are hidden from `GET /api/items` unless `?include_archived=1`. |
| `POST /api/templates`, `PATCH`/`DELETE /api/templates/:id` | CRUD. Deleting sets `trips.template_id` to NULL (existing FK). |
| `POST /api/parameters`, `PATCH`/`DELETE /api/parameters/:id` | CRUD for accommodation / environment / day_plans. `is_singleton` follows the category (accommodation only). Derived parameters are read-only. Delete is refused (409 `parameter_in_use`) while any item rule, template or trip references it. |
| `POST /api/catalog/preview` | Dry run: for a saved `item_id` or an unsaved `item`, and a trip (`trip_id`, or dates + parameters), returns `included`, `count` and the derived values. Writes nothing. |
| `POST /api/trips/:id/reapply` | Re-runs the current catalog on a trip with its own settings. Same contract as a settings PATCH: additions and count updates apply (user-edited counts and manual rows untouched), removals come back as `to_be_removed` for `POST /api/trips/:id/regenerate` after confirmation. |
| `GET /api/catalog` | The whole live catalog (parameters, items, templates) in the seed-file shape. |

**Integrity rules.** Every parameter id in an item's `include_when` and in a template's `default_parameters` must exist (400 `unknown_parameter`); templates may not list derived parameters. Catalog edits never touch existing trips by themselves; a trip picks them up only through `reapply` (or a settings change), so rule 3 (no silent destruction) holds.

**Safety.** No per-write backups (daily + pre-update + pre-restore already exist); agents are told to `POST /api/backups` before bulk edits.

### 10.3 Other phase-2+ items (parking lot)

- Pre-trip tasks (separate table & screen)
- Shopping list
- Bag-weight tracking
- Trip export to plain text
- ~~Joint-list UI~~ — superseded by multi-person trips, §13 (`is_shared` retired)
- Mutually-exclusive item groups
- Holiday detection beyond Shabbat
- Hebrew/Gregorian date toggle on date pickers

## 11. Implementation order & testing plan

Six numbered phases. Each phase ends in a runnable, demoable artifact. **Reuse libraries everywhere** (see CLAUDE.md § "Tech stack").

> **Status (July 2026):** Phases 0–3 are **complete**, including a UI/UX gap-closure pass that brought the screens in line with §4–§7 (per-row actions menu, regen-modal fixes, search/filters, derived-param display, upcoming/past trip sections, a11y sweep). Deliberate divergences are recorded in §12. **Phase 4 is the next milestone** — the Dockerfile `build`/`runtime` stages exist only as stubs. Phase 5+ not started. See `HANDOFF.md`.
>
> **Update (November 2026):** Phase 4 is **complete** for the LAN. The deploy target changed from Hostinger to a Proxmox LXC (see Phase 4 below and §12).

### Phase 0 — environment (no app code yet)

| Step | Deliverable | Test |
|------|-------------|------|
| 0.1 | `Dockerfile` for the Node app (multi-stage: dev / build / runtime) | `docker compose build app` succeeds |
| 0.2 | `docker-compose.yml` with `app`, `db_dev`, `db_test` services + named volume for `db_dev` + `tmpfs` for `db_test` | `docker compose up` brings both DBs up, app shell starts |
| 0.3 | `.gitignore`, `.dockerignore`, `.env.example` | manual review |
| 0.4 | SvelteKit + TS scaffold via `npm create svelte` inside container | `docker compose run --rm app npm run dev` serves a blank page |
| 0.5 | Vitest + Playwright installed; tsconfig strict | `docker compose run --rm app npm test` → "no tests" zero exit |

### Phase 1 — data layer & rules engine (the heart of the app)

This phase is **library-heavy, UI-free, fully testable**. Land it before any screen work.

| Step | Deliverable | Test |
|------|-------------|------|
| 1.1 | `schema.sql` (DDL from context.md, with an optional flag added to `items` and a new `parameters` table) | `db_dev` and `db_test` accept it via runner script |
| 1.2 | Migration runner (`umzug` + `mysql2` storage) | re-runnable; idempotent |
| 1.3 | `mysql2` connection pool helper (`src/lib/db/pool.ts`) | integration test connects |
| 1.4 | Zod schemas for the items/templates/parameters YAML files | unit: valid samples pass, malformed samples reject with clear errors |
| 1.5 | Excel extractor — reads the source spreadsheet via `xlsx`, emits draft YAML with `# REVIEW:` comments | manual review of output diff |
| 1.6 | Seeder — loads YAML → DB, transactional, idempotent (truncate-and-load) | integration: seed into `db_test`, assert row counts |
| 1.7 | `src/lib/rules/evaluator.ts` — condition DSL eval | **unit: every operator (`and`, `or`, `not`, `eq`, `gte`, `any_param`, `all_params`, `includes_shabbat`, literal true, string param). Edge cases: missing params, unknown operator, deep nesting, empty arrays.** |
| 1.8 | `src/lib/rules/quantity.ts` — quantity formula eval | unit: every formula type with realistic durations |
| 1.9 | `src/lib/rules/shabbat.ts` — wraps `@hebcal/core` | unit: known dates (has_shabbat / shabbat_count correct), trip starting Friday afternoon, trip ending Saturday night |
| 1.10 | `src/lib/rules/derived.ts` — `days`, `weekdays`, `weekends`, `has_shabbat`, `shabbat_count`, `long_trip`, `short_trip` | unit: trip lengths 1, 2, 7, 14, 30; cross-month, cross-year |
| 1.11 | `src/lib/rules/generate.ts` — trip generation pipeline (params → items + counts) | integration: seeded `db_test` + sample trip → expected item list |
| 1.12 | `src/lib/rules/merge.ts` — regeneration diff (added/updated/to_be_removed) | unit: manual items never touched, edited counts preserved, removed items surface |

**Phase 1 exit criteria:** every condition operator and every quantity formula has at least 3 passing unit tests; generate+merge integration test passes against `db_test`.

### Phase 2 — API surface

| Step | Deliverable | Test |
|------|-------------|------|
| 2.1 | SvelteKit `+server.ts` handlers, all parameter-validated with Zod | integration tests per endpoint hitting `db_test` |
| 2.2 | `GET /api/items`, `GET /api/items/:id`, `GET /api/templates`, `GET /api/templates/:id`, `GET /api/parameters` | smoke tests |
| 2.3 | `GET/POST/DELETE /api/trips`, `GET /api/trips/:id` | round-trip tests |
| 2.4 | `PATCH /api/trips/:id` (returns diff but applies safe ops), `POST /api/trips/:id/regenerate` (commits deletes) | dedicated test: edit settings, confirm diff payload shape, second-call commits |
| 2.5 | `PATCH /api/trips/:id/items/:itemId` (count, check, bag, notes), `POST /api/trips/:id/items` (manual add), `DELETE` (manual only) | tests including is_manual guard |
| 2.6 | `POST /api/trips/:id/items/:itemId/components/:cid` (kit component check) | test |

### Phase 3 — UI

Build screens in the order they unblock manual end-to-end testing:

| Step | Deliverable | Test |
|------|-------------|------|
| 3.1 | App shell (RTL, drawer, top bar, app.html) + Heebo font + design tokens | Playwright smoke: page loads, dir=rtl |
| 3.2 | Trips list `/` | component test + Playwright "create button visible when empty" |
| 3.3 | New-trip flow `/trips/new` (template picker → params with the 3-category form) | Playwright: complete a trip creation end-to-end |
| 3.4 | Packing list `/trips/[id]` minimum: rows, check, stepper, category groups, default sort | component tests for `PackingListRow`, `Stepper`; Playwright check-toggle |
| 3.5 | Kit expand component | component test |
| 3.6 | By-bag toggle + optional items styling + checked-to-bottom toggle | component tests |
| 3.7 | Trip settings page `/trips/[id]/settings` | Playwright: edit params, no-removal → silent toast |
| 3.8 | Regen diff modal (only when removals) | Playwright: change params to drop items, confirm modal appears with the right counts |
| 3.9 | Manual item add (bottom sheet with catalog search + free-text) | Playwright |
| 3.10 | Items catalog read-only `/items` + detail | component + Playwright |
| 3.11 | Templates read-only `/templates` + detail | smoke |

### Phase 4 — deploy

| Step | Deliverable |
|------|-------------|
| 4.1 | Proxmox helper `proxmox/packing-master.sh`: creates a small unprivileged Debian LXC (1 GB RAM, 4 GB disk), read-only GitHub deploy key for the private repo |
| 4.2 | `proxmox/install.sh`: Node.js 22 + MariaDB natively under systemd (no Docker), build, `update` command with pre-update backup and automatic rollback; documented in README |
| 4.3 | Data transfer: `npm run backup:dev` → upload + restore in System settings (replaces the manual `.sql` dump) |
| 4.4 | System settings screen (`/system`): version, check for updates, Update button, update log, backups (create / upload / download / restore / delete) |
| 4.5 | Agent API: `/llms.txt`, `/api`, `/api/openapi.json` from one registry |
| 4.6 | Smoke-test the live site (rehearsed in a Debian 13 + systemd container: install, restore, update, rollback) |
| 4.7 | Later: Cloudflare Tunnel + Cloudflare Access for remote access |

### Phase 5+ — see §10 "Phase 2 plan"

Items editor (easy mode → advanced block builder), tasks list, shopping list, etc.

### Testing strategy summary

- **Unit tests** (Vitest, no DB) — rules engine, schemas, helpers. These are the **bulk of the test suite**.
- **Integration tests** (Vitest with `db_test`) — seed flow, generate-and-merge, API handlers.
- **Component tests** (Vitest + Svelte Testing Library) — interactive components that have non-trivial state (`PackingListRow`, `RegenDiffModal`, `Stepper`, `RowActionsSheet`).
- **E2E tests** (Playwright) — only golden flows: create trip, check items, edit settings with/without removals.
- **Manual verification** — UI screens on a real phone-sized viewport once each phase 3 step lands.

CI considerations are out of scope for v1 (personal project). Local `docker compose run --rm app npm test` is the gate.

## 12. Implemented divergences from this spec (July 2026)

Where the implementation deliberately departs from §§4–7, and why. Anything not listed here follows the spec.

| # | Spec said | Implementation does | Why |
|---|-----------|--------------------|-----|
| 1 | §4.5 regen modal lists removals | Modal also has **per-row checkboxes** to keep individual items | Superset of spec; lets the user rescue single items instead of all-or-nothing |
| 2 | §4.2 recent templates surfaced above "All templates" | Single flat template list | No usage data to rank by; committed template sets are tiny |
| 3 | §4.1 long-press card menu (duplicate/delete); §4.3 trip menu with duplicate | No long-press menu; trip-level ⋯ menu offers settings + delete only. **Duplicate deferred** | Duplicate needs a new endpoint plus semantics decisions (reset checks? copy manual items?); delete is reachable via the ⋯ menu, making long-press redundant |
| 4 | §4.3 split items appear per-bag (silent on editing) | Per-bag rows show the split count with a **disabled stepper**; count edits happen in the split editor | Editing a per-bag count inline would be ambiguous (change the split or the total?) |
| 5 | — | Unknown bag ids fall back to the raw id | Bag labels come from `strings.json → view.bags`; the personal catalog should stick to those ids (`main_bag`, `small_bag`, `suitcase`, `carry_on`) |
| 6 | §4.6 count in the screen title bar | Count renders in the in-page heading, not the top app bar | The app-bar title is generic per-section; threading per-page counts into the layout isn't worth it |
| 7 | §4.6 footer "Source: seed/items.yaml" | Generic footer pointing at the `seed/` directory | The literal path no longer exists (`seed/sample/` + gitignored `seed/local/`) |
| 8 | §6 skeletons on initial page loads | No skeletons; thin top progress bar on client navigations >150ms | All screens are SSR-loaded — first paint already contains data, so skeletons would never show |
| 9 | — | `derive()` (with @hebcal/core) runs client-side in new-trip/settings for live date hints | ~100KB gz added to the bundle; accepted for a personal app. Alternative if it ever matters: a tiny `GET /api/derived?start&end` endpoint |
| 10 | §3 navigation: trips, items, templates | A fourth drawer entry, **System settings** (`/system`): version + Update button + update log, backups, links to the agent API docs | Added with the Proxmox deploy (Nov 2026); updates and backups need a home in the UI. Its controls follow the trip-menu patterns (inline confirm, toasts) |
| 11 | §11 Phase 4: Hostinger | Proxmox LXC on the LAN, Node + MariaDB natively, update button with rollback; Cloudflare Tunnel + Access later | User's own infrastructure; a small native LXC keeps the footprint low. MariaDB is kept compatible alongside MySQL 8 (tests run on both) |

## 13. Multi-person trips (approved November 2026)

The family is a group of **people**; each trip toggles who is coming. Item quantities can be per family, per person, per adult / kid / baby, or tied to one specific person (the baby's things). Replaces the "joint list" and "per-traveler split" parking-lot entries (§8, §10.3) and the unused `is_shared` flag.

### 13.1 Data model

- **`people`** table: `id` (snake_case), `display_name` (Hebrew, in the DB only, never in the repo), `kind` = `adult` | `kid` | `baby`, `sort_order`, `archived_at`. Kind is set by hand (update it when the baby becomes a kid); no birth dates.
- **Trip travelers:** the existing `trips.travelers` JSON column (always NULL so far) becomes an array of person ids. New trips store who is coming explicitly, every active person by default.
- **Item scope** — three item fields:
  - `per` = `family` | `person` | `adult` | `kid` | `baby`: who the formula's count is for. `family` is once per trip; the others repeat it for every traveler of that kind (`person` = every traveler).
  - `split` (default true): for a non-family scope, **one row per traveler** ("4 socks" for each of us, packed separately). `split: false` sums into **one shared row** (food: 2 per person per day → one row of 12 for three people).
  - `person_id`: the item is for that one person only — included if they are coming, one row labelled with their name, count × 1.
  - No matching traveler → the item is left out.
- **`trip_items.person_id`** (`''` for shared / family rows) joins the unique key `(trip_id, item_id, person_id)`, so the same catalog item can have one row per person. Kit components get the same column.

### 13.2 Rules language additions

- Conditions: `{"person": "<id>"}` (that person is coming), `{"kind": "baby"}` (at least one traveler of that kind). Usable inside `and` / `or` / `not` like any other condition.
- Quantities are unchanged; `per` / `split` / `person_id` decide how many rows and for whom. `GET /llms.txt` documents both, with examples.

### 13.3 Screens

- **Family** (new drawer entry, `/people`): list of people with kind; add, rename, change kind, remove (archived if a trip used them).
- **New trip / trip settings:** a "Who's coming" chip row above the parameters, every active person on by default. Changing it is a settings change, so it goes through the existing regen diff (nothing is removed without confirmation).
- **Packing list:** a per-person row shows the person's name next to the item name; shared rows look as today. Bag split stays as it is.
- **Items catalog:** the rule summary shows the scope ("per baby", "for <name>").

### 13.4 Migration of the existing catalog (decided 2026-11-19)

The 208 items marked personal (`is_shared = false`) were written for the owner alone. They become **tied to the owner** until the second adult starts using the app; the owner (or the agent) then un-ties them in bulk, which turns them into per-person rows.

Migration `0004` (a **breaking change** under workflow rule 9):

1. Creates `people`; if any item is personal, adds one adult with id `owner` (display name `owner`, renamed in the Family page — the repo holds no names).
2. Adds `items.per`, `items.split`, `items.person_id`; personal items → `per = person`, `person_id = owner`; shared items → `per = family`. Drops `is_shared`.
3. Adds `person_id` to `trip_items` and `trip_kit_components`; rows of owner-tied items get `owner`.
4. Old trips get `travelers = ["owner"]`, so their lists and counts do not change.

The backup restore gets the same transformation as an upgrader, so a backup taken before `0004` still restores.

### 13.5 API

`GET/POST /api/people`, `GET/PATCH/DELETE /api/people/:id`; `travelers: string[]` on trip create / patch / preview; `per`, `split`, `person_id` on items; `person_id` and `person_name` on trip rows. A trip row is addressed by `row_id`, or by `item_id` when that item has a single row on the trip (409 `ambiguous_item_key` otherwise). All in the API registry, so `/api`, `/api/openapi.json` and `/llms.txt` pick them up.

### 13.6 Tests

Unit: scopes, split, person-tied items, the two new condition operators, merge keyed by item + person. Integration: people CRUD, travelers through generate / patch / reapply, the `0004` migration on a pre-change database, and restoring a pre-change backup (rule 9) — on MySQL and MariaDB. Component + e2e: "Who's coming" and the person label on rows.
