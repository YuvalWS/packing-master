import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TripCreateRequest, TripPatchRequest } from '$lib/schemas/api/trip.js';
import { TripItemAddRequest, TripItemPatchRequest } from '$lib/schemas/api/trip-item.js';
import { RegenerateRequest } from '$lib/schemas/api/regenerate.js';
import { CreateBackupRequest } from '$lib/schemas/api/backup.js';
import {
  ItemCreateRequest,
  ItemPatchRequest,
  ParameterCreateRequest,
  ParameterPatchRequest,
  PreviewRequest,
  TemplateCreateRequest,
  TemplatePatchRequest
} from '$lib/schemas/api/catalog.js';

/*
 * One description of the HTTP API, rendered three ways for programs and AI agents:
 * GET /api (JSON index), GET /api/openapi.json (OpenAPI 3.1) and GET /llms.txt (a guide).
 * Request schemas come from the same Zod schemas the handlers validate with.
 */

export interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  notes?: string;
  body?: ZodTypeAny;
  bodyType?: string;
  example?: unknown;
  returns: string;
  tag: 'catalog' | 'catalog editing' | 'trips' | 'trip items' | 'backups' | 'system';
}

export const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/parameters',
    tag: 'catalog',
    summary: 'List trip parameters (the switches that decide which items a trip gets).',
    notes:
      'category is accommodation (pick exactly one), environment (any number) or day_plans (any number). is_derived parameters (derived_*) are computed from the dates; never send them.',
    returns: '{ parameters: [{ id, display_name, category, is_singleton, is_derived, sort_order }] }'
  },
  {
    method: 'GET',
    path: '/api/templates',
    tag: 'catalog',
    summary: 'List trip templates (named presets of parameters, e.g. a Shabbat-hosting weekend).',
    returns: '{ templates: [{ id, display_name, default_parameters: string[], default_extras, sort_order }] }'
  },
  {
    method: 'GET',
    path: '/api/templates/{id}',
    tag: 'catalog',
    summary: 'One template.',
    returns: '{ template }'
  },
  {
    method: 'GET',
    path: '/api/parameters/{id}',
    tag: 'catalog',
    summary: 'One parameter and what uses it (item rules, templates, trips).',
    returns: '{ parameter, used_by: { items: string[], templates: string[], trips: number[] } }'
  },
  {
    method: 'GET',
    path: '/api/catalog',
    tag: 'catalog',
    summary: 'The whole live catalog (parameters, items, templates) in one response.',
    returns: '{ parameters, items, templates }'
  },
  {
    method: 'GET',
    path: '/api/items',
    tag: 'catalog',
    summary: 'List the item catalog with each item\'s inclusion rule and quantity formula.',
    notes:
      'include_when and quantity use the rules language in /llms.txt. Archived items are hidden unless ?include_archived=1.',
    returns: '{ items: [{ id, display_name, category, default_bag, is_shared, is_optional, is_kit, kit_contents, include_when, quantity, notes, archived }] }'
  },
  {
    method: 'GET',
    path: '/api/items/{id}',
    tag: 'catalog',
    summary: 'One catalog item.',
    returns: '{ item }'
  },
  {
    method: 'POST',
    path: '/api/items',
    tag: 'catalog editing',
    summary: 'Add a catalog item with its rule and quantity formula.',
    notes:
      'id: a new snake_case ASCII id. display_name in Hebrew. Every parameter id in include_when must exist (400 unknown_parameter). Test the rule first with POST /api/catalog/preview. Existing trips change only via POST /api/trips/{id}/reapply.',
    body: ItemCreateRequest,
    example: {
      id: 'baby_wipes',
      display_name: '<Hebrew name>',
      category: 'baby',
      default_bag: 'main_bag',
      include_when: 'env_baby',
      quantity: { per_n_days: { n: 2, min: 1 } }
    },
    returns: '201 { item }'
  },
  {
    method: 'PATCH',
    path: '/api/items/{id}',
    tag: 'catalog editing',
    summary: 'Change an item: name, category, bag, rule, quantity, kit parts, notes, or archived.',
    notes:
      'Send only the fields to change; null clears an optional field. id cannot change. archived:false restores an archived item.',
    body: ItemPatchRequest,
    example: { include_when: { all_params: ['env_baby', 'env_cold'] }, quantity: { fixed: 2 } },
    returns: '{ item }'
  },
  {
    method: 'DELETE',
    path: '/api/items/{id}',
    tag: 'catalog editing',
    summary:
      'Remove an item from the catalog: deleted if no trip ever used it, otherwise archived (past trips keep it).',
    returns: '{ deleted: true } or { archived: true, used_by_trips: number[] }'
  },
  {
    method: 'POST',
    path: '/api/templates',
    tag: 'catalog editing',
    summary: 'Add a trip template (a named parameter preset).',
    notes: 'default_parameters: existing, non-derived parameter ids, normally exactly one accommodation.',
    body: TemplateCreateRequest,
    example: {
      id: 'tpl_family_weekend',
      display_name: '<Hebrew name>',
      default_parameters: ['accom_hosting', 'env_car', 'env_baby'],
      sort_order: 15
    },
    returns: '201 { template }'
  },
  {
    method: 'PATCH',
    path: '/api/templates/{id}',
    tag: 'catalog editing',
    summary: 'Change a template.',
    body: TemplatePatchRequest,
    example: { default_parameters: ['accom_hosting', 'env_car'] },
    returns: '{ template }'
  },
  {
    method: 'DELETE',
    path: '/api/templates/{id}',
    tag: 'catalog editing',
    summary: 'Delete a template (trips made from it keep their settings).',
    returns: '{ deleted: true }'
  },
  {
    method: 'POST',
    path: '/api/parameters',
    tag: 'catalog editing',
    summary: 'Add a parameter (a switch item rules can test), e.g. "travelling with a baby".',
    notes:
      'category: accommodation (a trip picks exactly one), environment or day_plans (any number). display_name in Hebrew.',
    body: ParameterCreateRequest,
    example: { id: 'env_baby', display_name: '<Hebrew name>', category: 'environment', sort_order: 80 },
    returns: '201 { parameter }'
  },
  {
    method: 'PATCH',
    path: '/api/parameters/{id}',
    tag: 'catalog editing',
    summary: 'Rename, re-categorise or reorder a parameter (derived_* parameters are read-only).',
    body: ParameterPatchRequest,
    example: { display_name: '<Hebrew name>' },
    returns: '{ parameter }'
  },
  {
    method: 'DELETE',
    path: '/api/parameters/{id}',
    tag: 'catalog editing',
    summary: 'Delete an unused parameter. 409 parameter_in_use (listing what uses it) otherwise.',
    returns: '{ deleted: true }'
  },
  {
    method: 'POST',
    path: '/api/catalog/preview',
    tag: 'catalog editing',
    summary: 'Dry-run a rule: would this item be on this trip, and how many? Writes nothing.',
    notes:
      'Give item_id (a saved item) or item (a draft, same shape as POST /api/items), plus trip_id or start_date + end_date + parameters.',
    body: PreviewRequest,
    example: {
      item: { id: 'draft', display_name: 'x', include_when: { any_param: ['env_baby'] }, quantity: { per_day: 6 } },
      start_date: '2026-11-20',
      end_date: '2026-11-22',
      parameters: ['accom_hosting', 'env_baby']
    },
    returns:
      '{ included, count, active_parameters, derived: { days, weekdays, weekends, shabbat_count, has_shabbat, long_trip, short_trip } }'
  },
  {
    method: 'GET',
    path: '/api/trips',
    tag: 'trips',
    summary: 'List trips, newest first, with item counts.',
    returns: '{ trips: [{ id, name, template_id, start_date, end_date, destination, context, item_count, checked_count, ... }] }'
  },
  {
    method: 'POST',
    path: '/api/trips',
    tag: 'trips',
    summary: 'Create a trip; its packing list is generated from the catalog rules.',
    notes:
      'parameters = the template\'s default_parameters plus any changes, exactly one accommodation parameter. name is optional (the UI shows a default).',
    body: TripCreateRequest,
    example: {
      template_id: 'tpl_example',
      start_date: '2026-11-20',
      end_date: '2026-11-22',
      destination: 'Grandparents',
      parameters: ['accom_hosting', 'env_car']
    },
    returns: '201 { trip, items: [trip item rows], derived: { days, has_shabbat, ... } }'
  },
  {
    method: 'GET',
    path: '/api/trips/{id}',
    tag: 'trips',
    summary: 'A trip with its full packing list (the main read for "what do I still need to pack").',
    notes:
      'Each item has row_id, item_id (null for free-text items), display_name, category, default_bag, count, is_checked, is_manual, notes, kit_contents. kit_components lists checked kit parts.',
    returns: '{ trip, items: [...], kit_components: [...] }'
  },
  {
    method: 'PATCH',
    path: '/api/trips/{id}',
    tag: 'trips',
    summary: 'Change trip settings (dates, parameters, name...) and re-run the rules.',
    notes:
      'New items are added and counts updated right away (counts the user edited are kept). Items that no longer apply are NOT deleted: they come back in diff.to_be_removed. Show them to the user, and only after they agree, delete them with POST /api/trips/{id}/regenerate.',
    body: TripPatchRequest,
    example: { end_date: '2026-11-23', parameters: ['accom_hosting', 'env_car', 'env_cold'] },
    returns: '{ trip, diff: { added: [...], updated: [...], to_be_removed: [{ row_id, item_id, display_name, count, is_checked }] } }'
  },
  {
    method: 'DELETE',
    path: '/api/trips/{id}',
    tag: 'trips',
    summary: 'Delete a trip and its list. Irreversible: confirm with the user first.',
    returns: '{ deleted: true }'
  },
  {
    method: 'POST',
    path: '/api/trips/{id}/reapply',
    tag: 'trips',
    summary: 'Apply catalog changes to an existing trip (same settings, current rules).',
    notes:
      'Same contract as the settings PATCH: additions and count updates apply now (counts the user edited and manual items are kept); items that no longer match come back in diff.to_be_removed for confirmation.',
    returns: '{ trip, diff: { added, updated, to_be_removed } }'
  },
  {
    method: 'POST',
    path: '/api/trips/{id}/regenerate',
    tag: 'trips',
    summary: 'Confirm removals proposed by a settings PATCH or a reapply (diff.to_be_removed).',
    notes: 'Only rule-generated items can be removed this way; manual items are refused.',
    body: RegenerateRequest,
    example: { remove_item_keys: [{ item_id: 'sunscreen' }, { row_id: 42 }] },
    returns: '{ deleted: number }'
  },
  {
    method: 'POST',
    path: '/api/trips/{id}/items',
    tag: 'trip items',
    summary: 'Add an item to a trip: a catalog item by item_id, or free text by display_name.',
    notes: 'Added items are manual: the rules engine never changes or removes them. 409 if the catalog item is already on the list.',
    body: TripItemAddRequest,
    example: { display_name: 'Baby carrier', count: 1, notes: 'in the car' },
    returns: '201 { item }'
  },
  {
    method: 'PATCH',
    path: '/api/trips/{id}/items/{key}',
    tag: 'trip items',
    summary: 'Check/uncheck an item, change its count, notes or bag split.',
    notes:
      '{key} is the catalog item_id (e.g. toothbrush) or the numeric row_id (needed for free-text items). Setting count marks it as user-edited, so later rule runs keep it.',
    body: TripItemPatchRequest,
    example: { is_checked: true },
    returns: '{ item }'
  },
  {
    method: 'DELETE',
    path: '/api/trips/{id}/items/{key}',
    tag: 'trip items',
    summary: 'Delete a manual item (rule-generated items cannot be deleted; uncheck or set count 0).',
    returns: '{ deleted: true }'
  },
  {
    method: 'POST',
    path: '/api/trips/{id}/items/{item_id}/components/{component_id}',
    tag: 'trip items',
    summary: 'Toggle the checked state of one part of a kit item.',
    returns: '{ component: { kit_item_id, component_id, is_checked } }'
  },
  {
    method: 'GET',
    path: '/api/backups',
    tag: 'backups',
    summary: 'List stored backups, newest first.',
    returns: '{ backups: [{ name, size, created_at, reason }], dir }'
  },
  {
    method: 'POST',
    path: '/api/backups',
    tag: 'backups',
    summary: 'Back up all data (catalog + trips) now. The body is optional.',
    body: CreateBackupRequest,
    example: { reason: 'manual' },
    returns: '201 { backup: { name, size, created_at, reason } }'
  },
  {
    method: 'GET',
    path: '/api/backups/{name}',
    tag: 'backups',
    summary: 'Download a backup (.json.gz).',
    returns: 'application/gzip'
  },
  {
    method: 'DELETE',
    path: '/api/backups/{name}',
    tag: 'backups',
    summary: 'Delete a stored backup.',
    returns: '{ deleted: true }'
  },
  {
    method: 'POST',
    path: '/api/backups/upload',
    tag: 'backups',
    summary: 'Store an uploaded backup file (raw .json.gz or .json body, not multipart). Does not restore it.',
    bodyType: 'application/gzip',
    returns: '201 { backup }'
  },
  {
    method: 'POST',
    path: '/api/backups/{name}/restore',
    tag: 'backups',
    summary: 'Replace ALL data with a backup. A pre-restore backup of the current data is made first. Confirm with the user.',
    returns: '{ restored: { table: rows }, safety_backup }'
  },
  {
    method: 'GET',
    path: '/api/system',
    tag: 'system',
    summary: 'Version, installed commit, newest available commit and the last update log.',
    returns: '{ version, installed, latest, update_available, can_update, update_requested, update_log }'
  },
  {
    method: 'POST',
    path: '/api/system/check',
    tag: 'system',
    summary: 'Ask the host to look for a newer version (result appears in GET /api/system after a few seconds).',
    returns: '202 { requested: true }'
  },
  {
    method: 'POST',
    path: '/api/system/update',
    tag: 'system',
    summary: 'Update to the newest version: backs up, pulls, rebuilds and restarts (the app is down ~2 minutes).',
    returns: '202 { requested: true }'
  },
  {
    method: 'GET',
    path: '/api/health',
    tag: 'system',
    summary: 'Liveness + database check.',
    returns: '{ ok, version, db }'
  }
];

function jsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const out = zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as Record<
    string,
    unknown
  >;
  delete out.$schema;
  return out;
}

export function apiIndex(version: string) {
  return {
    name: 'packing-master',
    version,
    description:
      'Personal packing-list app. A trip gets a generated packing list from a catalog of items whose inclusion depends on trip parameters and dates. JSON over HTTP, no auth on the LAN.',
    guide: '/llms.txt',
    openapi: '/api/openapi.json',
    errors: '{ error: code, message, details?, issues? } with a 4xx/5xx status',
    endpoints: ENDPOINTS.map((e) => ({
      method: e.method,
      path: e.path,
      summary: e.summary,
      ...(e.notes ? { notes: e.notes } : {}),
      ...(e.body ? { body: jsonSchema(e.body) } : {}),
      ...(e.bodyType ? { body_type: e.bodyType } : {}),
      ...(e.example !== undefined ? { example: e.example } : {}),
      returns: e.returns
    }))
  };
}

export function openApiDocument(version: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const params = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' }
    }));
    const op: Record<string, unknown> = {
      tags: [e.tag],
      summary: e.summary,
      description: [e.notes, `Returns: ${e.returns}`].filter(Boolean).join('\n\n'),
      operationId: `${e.method.toLowerCase()}${e.path.replace(/[{}]/g, '').replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))}`,
      responses: { default: { description: e.returns } }
    };
    if (params.length) op.parameters = params;
    if (e.body) {
      op.requestBody = {
        required: e.method !== 'POST' || e.path !== '/api/backups',
        content: {
          'application/json': {
            schema: jsonSchema(e.body),
            ...(e.example !== undefined ? { example: e.example } : {})
          }
        }
      };
    } else if (e.bodyType) {
      op.requestBody = {
        required: true,
        content: { [e.bodyType]: { schema: { type: 'string', format: 'binary' } } }
      };
    }
    (paths[e.path] ??= {})[e.method.toLowerCase()] = op;
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'packing-master',
      version,
      description: 'See /llms.txt for concepts and workflows.'
    },
    paths
  };
}

export function llmsTxt(version: string): string {
  const lines: string[] = [
    '# packing-master',
    '',
    `> Personal packing-list app (v${version}). JSON HTTP API; no authentication on the LAN. ` +
      'Machine-readable: GET /api (index with JSON schemas), GET /api/openapi.json.',
    '',
    'User-facing text (item and parameter names) is Hebrew; ids are ASCII snake_case.',
    '',
    '## Concepts',
    '',
    '- **Parameters** describe a trip: one `accommodation` (e.g. hosting, hotel, camping), any number of `environment` (abroad, cold, car...) and `day_plans` (hiking, swimming...). `derived_*` ones (has Shabbat, long/short trip) come from the dates automatically.',
    '- **Templates** are named parameter presets. Start a trip from the closest template.',
    '- **Catalog items** carry a rule (`include_when`) and a quantity formula; a trip\'s list is generated from them. The catalog is editable through the API; the live database is its source of truth.',
    '- **Trip items** are the rows of one trip\'s list: `count`, `is_checked`, `notes`. Address them by catalog `item_id` or by numeric `row_id` (free-text items only have a row_id).',
    '- **Manual items** (`is_manual: true`) were added by hand; rules never touch them.',
    '',
    '## Common tasks',
    '',
    '1. Plan a trip: `GET /api/templates` and `GET /api/parameters`, then `POST /api/trips` with dates (YYYY-MM-DD) and `parameters` (the template\'s `default_parameters` adjusted). Read the list back with `GET /api/trips/{id}`.',
    '2. What is left to pack: `GET /api/trips/{id}` and filter `items` where `is_checked` is false; group by `category` or `default_bag`.',
    '3. Mark packed: `PATCH /api/trips/{id}/items/{item_id or row_id}` with `{"is_checked": true}`.',
    '4. Something missing: `POST /api/trips/{id}/items` with `{"item_id": "..."}` for a catalog item or `{"display_name": "...", "count": 1}` for anything else.',
    '5. Plans changed: `PATCH /api/trips/{id}` with the new dates/parameters. Additions apply at once; `diff.to_be_removed` lists items that no longer fit. Ask the user, then `POST /api/trips/{id}/regenerate` with `{"remove_item_keys": [{"item_id": "..."}]}` for the ones they agree to drop.',
    '6. Before anything risky or a batch of catalog edits: `POST /api/backups`.',
    '7. Teach the catalog something new (e.g. baby gear): read `GET /api/parameters` and `GET /api/items` first to reuse ids, categories and bags; add a parameter only if none fits (`POST /api/parameters`); draft each item and test its rule with `POST /api/catalog/preview`; then `POST /api/items`. Fix with `PATCH /api/items/{id}`.',
    '8. Push catalog changes into an existing trip: `POST /api/trips/{id}/reapply`, then handle `to_be_removed` as in task 5.',
    '',
    '## Rules language',
    '',
    'An item is on a trip when its `include_when` condition is true; its count comes from `quantity`.',
    '',
    'Conditions (`include_when`):',
    '',
    '- `true`: every trip.',
    '- `"env_cold"`: that parameter is active (a bare parameter id).',
    '- `{"any_param": ["a", "b"]}` / `{"all_params": ["a", "b"]}`: any / all of them active.',
    '- `{"and": [c1, c2]}`, `{"or": [c1, c2]}`, `{"not": c}`: combine conditions.',
    '- `{"includes_shabbat": true}`: the dates include a Shabbat (same as `"derived_has_shabbat"`).',
    '- `{"gte": ["days", 4]}`: a trip number is at least N. Numbers: `days`, `weekdays` (Sun-Thu), `weekends` (Fri and Sat days), `shabbatCount`.',
    '- `{"eq": ["path", value]}`: a value in the trip `extras` (or one of the numbers above) equals `value`.',
    '- Derived parameters, set from the dates: `derived_has_shabbat`, `derived_long_trip` (14+ days), `derived_short_trip` (2 days or fewer).',
    '',
    'Quantities (`quantity`); `days` counts both the first and the last day:',
    '',
    '- `{"fixed": 2}`: always 2.',
    '- `{"per_day": 6}`: 6 per day (3-day trip: 18).',
    '- `{"per_n_days": {"n": 2, "min": 1}}`: one per 2 days, rounded up, at least `min`.',
    '- `{"per_weekday": 1}`, `{"per_shabbat": 1}`: per Sun-Thu day / per Shabbat in the dates.',
    '- `{"days_plus": {"add": 1, "min": 2}}`: days + add (one spare), at least `min`.',
    '',
    'Item fields: `category` and `default_bag` are free ids; reuse existing ones from `GET /api/items` (bags: `main_bag`, `small_bag`, `suitcase`, `carry_on`). `is_optional: true` marks a maybe-item. A kit (`is_kit: true`) lists its parts in `kit_contents: [{"id", "display_name", "default_count"}]`. Everything the user reads (`display_name`) is Hebrew.',
    '',
    '## Rules for agents',
    '',
    '- Never delete a trip, restore a backup or start an update without the user\'s explicit go-ahead.',
    '- Catalog edits affect every future trip: say what you will add or change before a batch, and preview rules on a real or sample trip.',
    '- Never remove items from `to_be_removed` without asking; checked items in it were already packed.',
    '- Prefer `item_id` keys for catalog items; use `row_id` for free-text items.',
    '- Errors are `{ "error": "<code>", ... }` with a 4xx status; `invalid_request` includes Zod `issues`.',
    '- Behind Cloudflare Access, send the service-token headers `CF-Access-Client-Id` and `CF-Access-Client-Secret`.',
    '',
    '## Endpoints',
    ''
  ];
  let tag = '';
  for (const e of ENDPOINTS) {
    if (e.tag !== tag) {
      tag = e.tag;
      lines.push(`### ${tag}`, '');
    }
    lines.push(`- \`${e.method} ${e.path}\` — ${e.summary}`);
    if (e.notes) lines.push(`  ${e.notes}`);
    if (e.example !== undefined) lines.push(`  Example body: \`${JSON.stringify(e.example)}\``);
    lines.push(`  Returns: ${e.returns}`);
  }
  lines.push('', 'Full request schemas: GET /api or GET /api/openapi.json.', '');
  return lines.join('\n');
}
