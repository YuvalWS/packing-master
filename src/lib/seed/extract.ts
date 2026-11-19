import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import type { Condition } from '../schemas/condition.js';
import type { QuantityFormula } from '../schemas/quantity.js';
import type { ExtractConfig, SheetConfig } from '../schemas/extract-config.js';

// Pure transform half of the Excel extractor. The CLI
// (extract-from-excel.ts) reads the workbook and hands the cell grid here.

export type Grid = string[][];

export interface Occurrence {
  sheet: string;
  /** Sheets that map to a template describe a real trip type; scratch sheets don't. */
  templated: boolean;
  row: number;
  column: number;
  raw: string;
  name: string;
  count?: number;
  is_optional: boolean;
  is_shared: boolean;
  category?: string;
  bag?: string;
  parameters: string[];
  quantity?: QuantityFormula;
}

export interface ParsedCell {
  name: string;
  count?: number;
  is_optional: boolean;
}

export interface DraftItem {
  id: string;
  display_name: string;
  category?: string;
  default_bag?: string;
  is_optional: boolean;
  is_shared: boolean;
  is_kit?: boolean;
  kit_contents?: { id: string; display_name: string; default_count: number }[];
  include_when: Condition;
  quantity: QuantityFormula;
  notes?: string;
  /** Provenance, rendered as YAML comments for the review pass. */
  review: {
    sheets: string[];
    occurrences: number;
    quantity_source: 'override' | 'rule' | 'column' | 'cell' | 'default';
    condition_source: 'override' | 'base_threshold' | 'unconditional' | 'parameters';
  };
}

export interface ExtractReport {
  ignored: { value: string; count: number }[];
  unmapped: { sheet: string; row: number; column: number; value: string }[];
  singleOccurrence: string[];
  defaultedQuantity: string[];
  unknownParameters: string[];
}

export interface ExtractResult {
  items: DraftItem[];
  occurrences: Occurrence[];
  report: ExtractReport;
}

const LEADING_COUNT = /^(\d+)\s*[*x×X]?\s*(?=\D)/;
const TRAILING_COUNT = /\s*[*x×X]\s*(\d+)\s*$/;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Splits a cell into a name plus the quantity and "maybe" markers baked into it. */
export function parseCell(raw: string): ParsedCell | null {
  let name = normalizeWhitespace(raw);
  if (!name) return null;

  let is_optional = false;
  while (name.endsWith('?')) {
    is_optional = true;
    name = name.slice(0, -1).trim();
  }
  if (!name) return null;

  let count: number | undefined;
  const trailing = TRAILING_COUNT.exec(name);
  if (trailing) {
    count = Number(trailing[1]);
    name = name.slice(0, trailing.index).trim();
  } else {
    const leading = LEADING_COUNT.exec(name);
    if (leading) {
      count = Number(leading[1]);
      name = name.slice(leading[0].length).trim();
    }
  }
  if (!name) return null;

  return { name, count, is_optional };
}

export function canonicalName(name: string, aliases: Record<string, string>): string {
  return aliases[name] ?? name;
}

export function itemId(name: string): string {
  return `item_${createHash('sha1').update(name).digest('hex').slice(0, 10)}`;
}

function compileIgnore(config: ExtractConfig): (value: string) => boolean {
  const values = new Set(config.ignore.values.map(normalizeWhitespace));
  const patterns = config.ignore.patterns.map((p) => new RegExp(p));
  return (value: string) => {
    const v = normalizeWhitespace(value);
    if (!v) return true;
    if (values.has(v)) return true;
    return patterns.some((re) => re.test(v));
  };
}

function rangeCovers(
  range: { from_row?: number; to_row?: number },
  row: number
): boolean {
  if (range.from_row !== undefined && row < range.from_row) return false;
  if (range.to_row !== undefined && row > range.to_row) return false;
  return true;
}

function collectGridSheet(
  sheet: SheetConfig,
  grid: Grid,
  ignored: (value: string) => boolean,
  config: ExtractConfig,
  out: Occurrence[],
  report: ExtractReport
): void {
  const ignoredCounts = new Map<string, number>();
  for (let row = 0; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    for (let column = 0; column < cells.length; column++) {
      const raw = normalizeWhitespace(cells[column] ?? '');
      if (!raw) continue;

      // Ignore-listed headers are checked before the column map so they never
      // show up as unmapped noise in the report.
      if (ignored(raw)) {
        ignoredCounts.set(raw, (ignoredCounts.get(raw) ?? 0) + 1);
        continue;
      }

      const range = sheet.columns.find((c) => c.index === column && rangeCovers(c, row));
      if (!range) {
        report.unmapped.push({ sheet: sheet.name, row, column, value: raw });
        continue;
      }

      const parsed = parseCell(raw);
      if (!parsed || ignored(parsed.name)) {
        if (parsed) ignoredCounts.set(parsed.name, (ignoredCounts.get(parsed.name) ?? 0) + 1);
        continue;
      }

      out.push({
        sheet: sheet.name,
        templated: !!sheet.template,
        row,
        column,
        raw,
        name: canonicalName(parsed.name, config.aliases),
        count: parsed.count,
        is_optional: parsed.is_optional || range.is_optional,
        is_shared: range.is_shared,
        category: range.category,
        bag: range.bag,
        parameters: [...sheet.parameters, ...range.parameters],
        quantity: range.quantity
      });
    }
  }
  for (const [value, count] of ignoredCounts) {
    report.ignored.push({ value, count });
  }
}

function collectTableSheet(
  sheet: SheetConfig,
  grid: Grid,
  ignored: (value: string) => boolean,
  config: ExtractConfig,
  out: Occurrence[],
  report: ExtractReport
): void {
  const layout = sheet.table;
  if (!layout) return;

  let category = '';
  for (let row = layout.header_rows; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    const categoryCell = normalizeWhitespace(cells[layout.category_column] ?? '');
    if (categoryCell) category = categoryCell;

    const raw = normalizeWhitespace(cells[layout.item_column] ?? '');
    if (!raw) continue;
    if (ignored(raw)) {
      report.ignored.push({ value: raw, count: 1 });
      continue;
    }
    const parsed = parseCell(raw);
    if (!parsed || ignored(parsed.name)) continue;

    const countCell =
      layout.count_column === undefined
        ? ''
        : normalizeWhitespace(cells[layout.count_column] ?? '');
    const cellCount = /^\d+$/.test(countCell) ? Number(countCell) : undefined;

    out.push({
      sheet: sheet.name,
      templated: !!sheet.template,
      row,
      column: layout.item_column,
      raw,
      name: canonicalName(parsed.name, config.aliases),
      count: parsed.count ?? (cellCount && cellCount > 0 ? cellCount : undefined),
      is_optional: parsed.is_optional,
      is_shared: false,
      category: category || undefined,
      bag: layout.category_bags[category] ?? layout.bag,
      parameters: [
        ...sheet.parameters,
        ...layout.parameters,
        ...(layout.category_parameters[category] ?? [])
      ]
    });
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/** Turns the parameter sets an item was seen under into one condition. */
export function buildCondition(parameterSets: string[][]): Condition {
  const sets = parameterSets.map((s) => uniqueSorted(s));
  if (sets.length === 0 || sets.some((s) => s.length === 0)) return true;

  const keyed = new Map<string, string[]>();
  for (const set of sets) keyed.set(set.join('|'), set);
  const distinct = [...keyed.values()];

  const asCondition = (set: string[]): Condition => {
    const first = set[0];
    return set.length === 1 && first !== undefined ? first : { all_params: set };
  };

  if (distinct.length === 1) return asCondition(distinct[0] ?? []);

  const singles = distinct.map((s) => (s.length === 1 ? s[0] : undefined));
  if (singles.every((s): s is string => s !== undefined)) {
    return { any_param: uniqueSorted(singles) };
  }
  return { or: distinct.map(asCondition) };
}

function mostCommon(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function buildItems(occurrences: Occurrence[], config: ExtractConfig): DraftItem[] {
  const byName = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const list = byName.get(occ.name) ?? [];
    list.push(occ);
    byName.set(occ.name, list);
  }

  const items: DraftItem[] = [];
  for (const [name, occs] of byName) {
    const override = config.item_overrides[name] ?? {};
    if (override.skip) continue;

    const display_name = override.display_name ?? name;
    const templatedSheets = uniqueSorted(occs.filter((o) => o.templated).map((o) => o.sheet));

    let include_when: Condition;
    let condition_source: DraftItem['review']['condition_source'];
    if (override.include_when !== undefined) {
      include_when = override.include_when;
      condition_source = 'override';
    } else if (templatedSheets.length >= config.base_threshold) {
      include_when = true;
      condition_source = 'base_threshold';
    } else {
      include_when = buildCondition(occs.map((o) => o.parameters));
      condition_source = include_when === true ? 'unconditional' : 'parameters';
    }

    const counts = occs.map((o) => o.count).filter((c): c is number => typeof c === 'number');
    const columnQuantity = occs.find((o) => o.quantity)?.quantity;
    let quantity: QuantityFormula;
    let quantity_source: DraftItem['review']['quantity_source'];
    if (override.quantity) {
      quantity = override.quantity;
      quantity_source = 'override';
    } else if (config.quantity_rules[name]) {
      quantity = config.quantity_rules[name];
      quantity_source = 'rule';
    } else if (columnQuantity) {
      quantity = columnQuantity;
      quantity_source = 'column';
    } else if (counts.length > 0) {
      quantity = { fixed: Math.max(...counts) };
      quantity_source = 'cell';
    } else {
      quantity = { fixed: 1 };
      quantity_source = 'default';
    }

    // An item that ends up unconditional is described by the least conditional
    // blocks it appeared in — a belt listed under a Shabbat block on one sheet
    // and under clothing on another is a clothing item, not a Shabbat item.
    let describing = occs;
    if (include_when === true) {
      const fewest = Math.min(...occs.map((o) => o.parameters.length));
      describing = occs.filter((o) => o.parameters.length === fewest);
    }

    items.push({
      id: override.id ?? itemId(name),
      display_name,
      category: override.category ?? mostCommon(describing.map((o) => o.category)),
      default_bag: override.default_bag ?? mostCommon(describing.map((o) => o.bag)),
      is_optional: override.is_optional ?? occs.every((o) => o.is_optional),
      is_shared: override.is_shared ?? occs.some((o) => o.is_shared),
      is_kit: override.is_kit,
      kit_contents: override.kit_contents,
      include_when,
      quantity,
      notes: override.notes,
      review: {
        sheets: uniqueSorted(occs.map((o) => o.sheet)),
        occurrences: occs.length,
        quantity_source,
        condition_source
      }
    });
  }

  items.sort(
    (a, b) =>
      (a.category ?? '').localeCompare(b.category ?? '') ||
      a.display_name.localeCompare(b.display_name)
  );
  return items;
}

export function extract(grids: Map<string, Grid>, config: ExtractConfig): ExtractResult {
  const ignored = compileIgnore(config);
  const occurrences: Occurrence[] = [];
  const report: ExtractReport = {
    ignored: [],
    unmapped: [],
    singleOccurrence: [],
    defaultedQuantity: [],
    unknownParameters: []
  };

  for (const sheet of config.sheets) {
    if (sheet.skip) continue;
    const grid = grids.get(sheet.name);
    if (!grid) throw new Error(`sheet not found in workbook: ${sheet.name}`);
    if (sheet.mode === 'table') {
      collectTableSheet(sheet, grid, ignored, config, occurrences, report);
    } else {
      collectGridSheet(sheet, grid, ignored, config, occurrences, report);
    }
  }

  const items = buildItems(occurrences, config);

  const knownParameters = new Set(config.parameters.map((p) => p.id));
  const referenced = new Set<string>();
  for (const occ of occurrences) for (const p of occ.parameters) referenced.add(p);
  for (const sheet of config.sheets) {
    for (const p of sheet.template?.default_parameters ?? []) referenced.add(p);
  }
  report.unknownParameters = [...referenced].filter((p) => !knownParameters.has(p)).sort();
  report.singleOccurrence = items
    .filter((i) => i.review.occurrences === 1)
    .map((i) => i.display_name);
  report.defaultedQuantity = items
    .filter((i) => i.review.quantity_source === 'default')
    .map((i) => i.display_name);

  return { items, occurrences, report };
}

function inline(value: unknown): string {
  return yaml.dump(value, { flowLevel: 0, lineWidth: -1 }).trim();
}

function scalar(value: string): string {
  return yaml.dump(value, { lineWidth: -1 }).trim();
}

export function renderItemsYaml(items: DraftItem[]): string {
  const lines: string[] = [
    '# Generated by `npm run extract:excel` from the source spreadsheet.',
    '# Personal catalog — this directory is gitignored.',
    '# Lines marked REVIEW were guessed by the extractor; adjust and re-seed.',
    '',
    'items:'
  ];
  for (const item of items) {
    const notes: string[] = [`sheets: ${item.review.sheets.join(', ')}`];
    if (item.review.quantity_source === 'default') notes.push('quantity guessed');
    if (item.review.condition_source === 'base_threshold') notes.push('treated as base item');
    if (item.review.occurrences === 1) notes.push('seen once');
    lines.push(`  # REVIEW: ${notes.join(' | ')}`);
    lines.push(`  - id: ${item.id}`);
    lines.push(`    display_name: ${scalar(item.display_name)}`);
    if (item.category) lines.push(`    category: ${scalar(item.category)}`);
    if (item.default_bag) lines.push(`    default_bag: ${item.default_bag}`);
    if (item.is_optional) lines.push('    is_optional: true');
    // Shared items keep the default scope (once per family); the rest are per person.
    if (!item.is_shared) lines.push('    per: person');
    if (item.is_kit) {
      lines.push('    is_kit: true');
      lines.push('    kit_contents:');
      for (const c of item.kit_contents ?? []) {
        lines.push(`      - id: ${c.id}`);
        lines.push(`        display_name: ${scalar(c.display_name)}`);
        lines.push(`        default_count: ${c.default_count}`);
      }
    }
    lines.push(`    include_when: ${inline(item.include_when)}`);
    lines.push(`    quantity: ${inline(item.quantity)}`);
    if (item.notes) lines.push(`    notes: ${scalar(item.notes)}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderParametersYaml(config: ExtractConfig): string {
  return [
    '# Generated by `npm run extract:excel` from the extractor config.',
    '# Personal catalog — this directory is gitignored.',
    '',
    yaml.dump({ parameters: config.parameters }, { lineWidth: -1 }).trim(),
    ''
  ].join('\n');
}

export function renderTemplatesYaml(config: ExtractConfig): string {
  const templates = config.sheets
    .filter((s) => !s.skip && s.template)
    .map((s) => s.template!)
    .sort((a, b) => a.sort_order - b.sort_order);
  return [
    '# Generated by `npm run extract:excel` from the extractor config.',
    '# Personal catalog — this directory is gitignored.',
    '',
    yaml.dump({ templates }, { lineWidth: -1 }).trim(),
    ''
  ].join('\n');
}

export function renderReport(result: ExtractResult): string {
  const lines: string[] = [
    `items: ${result.items.length}`,
    `occurrences: ${result.occurrences.length}`,
    ''
  ];
  if (result.report.unknownParameters.length) {
    lines.push('## parameters referenced but not declared');
    lines.push(...result.report.unknownParameters.map((p) => `  ${p}`));
    lines.push('');
  }
  lines.push('## cells in unmapped columns (not extracted)');
  for (const u of result.report.unmapped) {
    lines.push(`  ${u.sheet} r${u.row} c${u.column}: ${u.value}`);
  }
  lines.push('');
  lines.push('## ignored by config');
  for (const i of result.report.ignored.sort((a, b) => b.count - a.count)) {
    lines.push(`  (${i.count}) ${i.value}`);
  }
  lines.push('');
  lines.push('## quantity defaulted to fixed 1');
  lines.push(...result.report.defaultedQuantity.map((n) => `  ${n}`));
  lines.push('');
  lines.push('## seen on a single sheet');
  lines.push(...result.report.singleOccurrence.map((n) => `  ${n}`));
  lines.push('');
  return lines.join('\n');
}
