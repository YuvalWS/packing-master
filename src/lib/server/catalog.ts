import type { Pool } from 'mysql2/promise';
import { ApiError } from '$lib/api/errors.js';
import { ItemSchema, type Item } from '$lib/schemas/item.js';
import type { Parameter } from '$lib/schemas/parameter.js';
import { TemplateSchema, type Template } from '$lib/schemas/template.js';
import type {
  ItemPatchRequest,
  ParameterCreateRequest,
  ParameterPatchRequest,
  PreviewRequest,
  TemplatePatchRequest
} from '$lib/schemas/api/catalog.js';
import { conditionParamIds, conditionPersonIds } from '$lib/util/condition-params.js';
import * as peopleQ from '$lib/db/queries/people.js';
import type { Person } from '$lib/schemas/person.js';
import type { PersonCreateRequest, PersonPatchRequest } from '$lib/schemas/api/catalog.js';
import { requireTravelers, resolveTravelers } from './travelers.js';
import * as itemsQ from '$lib/db/queries/items.js';
import * as parametersQ from '$lib/db/queries/parameters.js';
import * as templatesQ from '$lib/db/queries/templates.js';
import * as tripsQ from '$lib/db/queries/trips.js';
import { generate } from '$lib/rules/generate.js';
import { derive } from '$lib/rules/derived.js';

// The catalog write side (DESIGN.md 10.0). Handlers validate the request shape; this
// module enforces references between items, templates, parameters and trips.

async function requireKnownParameters(pool: Pool, ids: string[], forTemplate: boolean) {
  if (ids.length === 0) return;
  const params = new Map((await parametersQ.listAll(pool)).map((p) => [p.id, p]));
  const unknown = ids.filter((id) => !params.has(id));
  if (unknown.length > 0) throw new ApiError(400, 'unknown_parameter', { ids: unknown });
  if (forTemplate) {
    const derived = ids.filter((id) => params.get(id)!.is_derived);
    if (derived.length > 0) throw new ApiError(400, 'derived_parameter_not_allowed', { ids: derived });
  }
}

async function requireKnownPeople(pool: Pool, item: Item) {
  const ids = [...conditionPersonIds(item.include_when), ...(item.person_id ? [item.person_id] : [])];
  if (ids.length === 0) return;
  const known = new Set((await peopleQ.listAll(pool, true)).map((p) => p.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new ApiError(400, 'unknown_person', { ids: unknown });
}

function validateItem(raw: unknown): Item {
  const parsed = ItemSchema.safeParse(raw);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

export async function createItem(pool: Pool, item: Item): Promise<itemsQ.CatalogItem> {
  if (await itemsQ.getCatalogItem(pool, item.id)) throw new ApiError(409, 'item_exists');
  await requireKnownParameters(pool, conditionParamIds(item.include_when), false);
  await requireKnownPeople(pool, item);
  await itemsQ.insert(pool, item);
  return (await itemsQ.getCatalogItem(pool, item.id))!;
}

export async function updateItem(
  pool: Pool,
  id: string,
  patch: ItemPatchRequest
): Promise<itemsQ.CatalogItem> {
  const existing = await itemsQ.getCatalogItem(pool, id);
  if (!existing) throw new ApiError(404, 'item_not_found');
  const { archived, ...fields } = patch;
  const { archived: wasArchived, ...current } = existing;
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(fields)) {
    if (v === null) delete merged[k];
    else if (v !== undefined) merged[k] = v;
  }
  if (fields.is_kit === false && fields.kit_contents === undefined) delete merged.kit_contents;
  const next = validateItem(merged);
  if (patch.include_when !== undefined) {
    await requireKnownParameters(pool, conditionParamIds(next.include_when), false);
  }
  if (patch.include_when !== undefined || patch.person_id) await requireKnownPeople(pool, next);
  await itemsQ.replace(pool, next, archived ?? wasArchived);
  return (await itemsQ.getCatalogItem(pool, id))!;
}

export async function deleteItem(
  pool: Pool,
  id: string
): Promise<{ deleted: true } | { archived: true; used_by_trips: number[] }> {
  const existing = await itemsQ.getCatalogItem(pool, id);
  if (!existing) throw new ApiError(404, 'item_not_found');
  const trips = await itemsQ.tripsUsing(pool, id);
  if (trips.length === 0) {
    await itemsQ.deleteById(pool, id);
    return { deleted: true };
  }
  await itemsQ.replace(pool, existing, true);
  return { archived: true, used_by_trips: trips };
}

export async function createTemplate(pool: Pool, t: Template): Promise<Template> {
  if (await templatesQ.getById(pool, t.id)) throw new ApiError(409, 'template_exists');
  await requireKnownParameters(pool, t.default_parameters, true);
  await templatesQ.insert(pool, t);
  return (await templatesQ.getById(pool, t.id))!;
}

export async function updateTemplate(
  pool: Pool,
  id: string,
  patch: TemplatePatchRequest
): Promise<Template> {
  const existing = await templatesQ.getById(pool, id);
  if (!existing) throw new ApiError(404, 'template_not_found');
  const merged: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete merged[k];
    else if (v !== undefined) merged[k] = v;
  }
  const parsed = TemplateSchema.safeParse(merged);
  if (!parsed.success) throw parsed.error;
  if (patch.default_parameters) await requireKnownParameters(pool, parsed.data.default_parameters, true);
  await templatesQ.replace(pool, parsed.data);
  return (await templatesQ.getById(pool, id))!;
}

export async function deleteTemplate(pool: Pool, id: string): Promise<void> {
  if (!(await templatesQ.deleteById(pool, id))) throw new ApiError(404, 'template_not_found');
}

export async function createParameter(pool: Pool, req: ParameterCreateRequest): Promise<Parameter> {
  if (await parametersQ.getById(pool, req.id)) throw new ApiError(409, 'parameter_exists');
  const p: Parameter = {
    ...req,
    is_singleton: req.category === 'accommodation',
    is_derived: false
  };
  await parametersQ.insert(pool, p);
  return p;
}

export async function updateParameter(
  pool: Pool,
  id: string,
  patch: ParameterPatchRequest
): Promise<Parameter> {
  const existing = await parametersQ.getById(pool, id);
  if (!existing) throw new ApiError(404, 'parameter_not_found');
  if (existing.is_derived) throw new ApiError(400, 'derived_parameter_readonly');
  const category = patch.category ?? existing.category;
  const next: Parameter = {
    ...existing,
    ...patch,
    category,
    is_singleton: category === 'accommodation'
  };
  await parametersQ.replace(pool, next);
  return next;
}

export interface ParameterUsage {
  items: string[];
  templates: string[];
  trips: number[];
}

export async function parameterUsage(pool: Pool, id: string): Promise<ParameterUsage> {
  const [items, templates, trips] = await Promise.all([
    itemsQ.listCatalog(pool, true),
    templatesQ.listAll(pool),
    tripsQ.listAll(pool)
  ]);
  return {
    items: items.filter((i) => conditionParamIds(i.include_when).includes(id)).map((i) => i.id),
    templates: templates.filter((t) => t.default_parameters.includes(id)).map((t) => t.id),
    trips: trips.filter((t) => t.context.parameters.includes(id)).map((t) => t.id)
  };
}

export async function deleteParameter(pool: Pool, id: string): Promise<void> {
  const existing = await parametersQ.getById(pool, id);
  if (!existing) throw new ApiError(404, 'parameter_not_found');
  if (existing.is_derived) throw new ApiError(400, 'derived_parameter_readonly');
  const usage = await parameterUsage(pool, id);
  if (usage.items.length + usage.templates.length + usage.trips.length > 0) {
    throw new ApiError(409, 'parameter_in_use', usage);
  }
  await parametersQ.deleteById(pool, id);
}

export async function preview(pool: Pool, req: PreviewRequest) {
  let item: Item;
  if (req.item) {
    item = req.item;
    await requireKnownParameters(pool, conditionParamIds(item.include_when), false);
    await requireKnownPeople(pool, item);
  } else {
    const found = await itemsQ.getById(pool, req.item_id!);
    if (!found) throw new ApiError(404, 'item_not_found');
    item = found;
  }
  let start: string, end: string, params: string[], extras: Record<string, unknown> | undefined;
  let travelerIds: string[] | null;
  if (req.trip_id !== undefined) {
    const trip = await tripsQ.getById(pool, req.trip_id);
    if (!trip) throw new ApiError(404, 'trip_not_found');
    start = trip.start_date;
    end = trip.end_date;
    params = trip.context.parameters;
    extras = trip.context.extras;
    travelerIds = trip.travelers;
  } else {
    start = req.start_date!;
    end = req.end_date!;
    params = req.parameters!;
    extras = req.extras;
    travelerIds = req.travelers
      ? await requireTravelers(pool, req.travelers)
      : (await peopleQ.listAll(pool)).map((p) => p.id);
    if (travelerIds.length === 0 && !req.travelers) travelerIds = null;
  }
  const travelers = await resolveTravelers(pool, travelerIds);
  if (end < start) throw new ApiError(400, 'invalid_dates');
  const parameters = await parametersQ.listAll(pool);
  let result;
  try {
    result = generate({
      items: [item],
      parameters,
      userParams: params,
      startISO: start,
      endISO: end,
      extraContext: extras,
      travelers
    });
  } catch (err) {
    throw new ApiError(400, 'generate_failed', err instanceof Error ? err.message : String(err));
  }
  const rows = result.items.filter((g) => g.itemId === item.id);
  const d = derive(start, end);
  return {
    included: rows.length > 0,
    count: rows.reduce((n, r) => n + r.count, 0),
    rows: rows.map((r) => ({ person_id: r.personId || null, count: r.count })),
    travelers: travelerIds,
    active_parameters: result.activeParams,
    derived: {
      days: d.days,
      weekdays: d.weekdays,
      weekends: d.weekends,
      shabbat_count: d.shabbatCount,
      has_shabbat: d.hasShabbat,
      long_trip: d.longTrip,
      short_trip: d.shortTrip
    }
  };
}

export async function exportCatalog(pool: Pool) {
  const [parameters, items, templates, people] = await Promise.all([
    parametersQ.listAll(pool),
    itemsQ.listAll(pool),
    templatesQ.listAll(pool),
    peopleQ.listAll(pool)
  ]);
  return {
    parameters,
    items,
    templates,
    people: people.map(({ archived: _a, ...p }) => p)
  };
}

// ---- people (DESIGN.md 13) -----------------------------------------------------------

export interface PersonUsage {
  items: string[];
  trips: number[];
}

export async function personUsage(pool: Pool, id: string): Promise<PersonUsage> {
  const [items, trips] = await Promise.all([itemsQ.listCatalog(pool, true), tripsQ.listAll(pool)]);
  return {
    items: items
      .filter((i) => i.person_id === id || conditionPersonIds(i.include_when).includes(id))
      .map((i) => i.id),
    trips: trips.filter((t) => (t.travelers ?? []).includes(id)).map((t) => t.id)
  };
}

export async function createPerson(pool: Pool, p: PersonCreateRequest): Promise<peopleQ.PersonRow> {
  if (await peopleQ.getById(pool, p.id)) throw new ApiError(409, 'person_exists');
  await peopleQ.insert(pool, p);
  return (await peopleQ.getById(pool, p.id))!;
}

export async function updatePerson(
  pool: Pool,
  id: string,
  patch: PersonPatchRequest
): Promise<peopleQ.PersonRow> {
  const existing = await peopleQ.getById(pool, id);
  if (!existing) throw new ApiError(404, 'person_not_found');
  const { archived, ...fields } = patch;
  const { archived: wasArchived, ...current } = existing;
  const next: Person = { ...current, ...fields };
  await peopleQ.replace(pool, next, archived ?? wasArchived);
  return (await peopleQ.getById(pool, id))!;
}

/** Deletes a person nothing refers to; otherwise archives them (past trips keep them). */
export async function deletePerson(
  pool: Pool,
  id: string
): Promise<{ deleted: true } | { archived: true; used_by: PersonUsage }> {
  const existing = await peopleQ.getById(pool, id);
  if (!existing) throw new ApiError(404, 'person_not_found');
  const usage = await personUsage(pool, id);
  if (usage.items.length + usage.trips.length === 0) {
    await peopleQ.deleteById(pool, id);
    return { deleted: true };
  }
  const { archived: _a, ...p } = existing;
  await peopleQ.replace(pool, p, true);
  return { archived: true, used_by: usage };
}
