import * as xlsx from 'xlsx';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Authoring tool. Reads the spreadsheet at PACKING_EXCEL_PATH and writes
// a draft set of YAML files to the output directory (default: seed/local).
//
// The extractor is deliberately permissive about structure. It treats every
// non-empty text cell as an item candidate (deduplicated by trimmed value)
// and every sheet as a template. Quantities default to `fixed: 1` and
// conditions default to `true`, with `# REVIEW:` markers throughout — the
// user is expected to refine the output by hand.

interface ItemDraft {
  id: string;
  display_name: string;
  source_sheets: string[];
}

interface TemplateDraft {
  id: string;
  display_name: string;
  source_sheet: string;
  item_display_names: string[];
}

function shortHash(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 10);
}

function slug(prefix: string, source: string): string {
  return `${prefix}_${shortHash(source)}`;
}

function yamlEscape(s: string): string {
  if (/[:#\n"'\\]/.test(s) || s.startsWith('-') || s.startsWith(' ') || s.endsWith(' ')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function buildItems(book: xlsx.WorkBook): Map<string, ItemDraft> {
  const items = new Map<string, ItemDraft>();
  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    if (!sheet) continue;
    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell !== 'string') continue;
        const name = cell.trim();
        if (!name) continue;
        const existing = items.get(name);
        if (existing) {
          if (!existing.source_sheets.includes(sheetName)) {
            existing.source_sheets.push(sheetName);
          }
        } else {
          items.set(name, {
            id: slug('item', name),
            display_name: name,
            source_sheets: [sheetName]
          });
        }
      }
    }
  }
  return items;
}

function buildTemplates(book: xlsx.WorkBook): TemplateDraft[] {
  const out: TemplateDraft[] = [];
  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    if (!sheet) continue;
    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const names = new Set<string>();
    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell !== 'string') continue;
        const n = cell.trim();
        if (n) names.add(n);
      }
    }
    if (names.size === 0) continue;
    out.push({
      id: slug('tpl', sheetName),
      display_name: sheetName,
      source_sheet: sheetName,
      item_display_names: [...names]
    });
  }
  return out;
}

function renderParametersYaml(): string {
  return `# REVIEW: Replace these stubs with your real parameters.
# At least one parameter with category=accommodation and is_singleton=true is required.

parameters:
  - id: accom_default
    display_name: Default Accommodation
    category: accommodation
    is_singleton: true
`;
}

function renderItemsYaml(items: ItemDraft[]): string {
  const lines: string[] = [
    '# Draft items extracted from the source spreadsheet.',
    '# REVIEW each item: refine include_when, quantity, category, default_bag, is_optional.',
    '',
    'items:'
  ];
  for (const item of items) {
    lines.push(`  # REVIEW: source sheets: ${item.source_sheets.join(', ')}`);
    lines.push(`  - id: ${item.id}`);
    lines.push(`    display_name: ${yamlEscape(item.display_name)}`);
    lines.push(`    include_when: true   # REVIEW`);
    lines.push(`    quantity:`);
    lines.push(`      fixed: 1   # REVIEW`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderTemplatesYaml(templates: TemplateDraft[]): string {
  const lines: string[] = [
    '# Draft templates extracted from the source spreadsheet.',
    '# REVIEW each template: set the correct default_parameters.',
    '',
    'templates:'
  ];
  for (const t of templates) {
    lines.push(`  # REVIEW: source sheet "${t.source_sheet}", ${t.item_display_names.length} items`);
    lines.push(`  - id: ${t.id}`);
    lines.push(`    display_name: ${yamlEscape(t.display_name)}`);
    lines.push(`    default_parameters:`);
    lines.push(`      - accom_default   # REVIEW`);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const excelPath = process.env.PACKING_EXCEL_PATH ?? process.argv[2];
  const outDir = process.argv[3] ?? 'seed/local';

  if (!excelPath) {
    console.error('PACKING_EXCEL_PATH env var (or argv[2]) is required');
    process.exit(1);
  }
  if (!existsSync(excelPath)) {
    console.error(`spreadsheet not found at ${excelPath}`);
    process.exit(1);
  }

  console.log(`reading ${excelPath}`);
  const book = xlsx.readFile(excelPath);
  console.log(`found ${book.SheetNames.length} sheets`);

  const itemsMap = buildItems(book);
  const items = [...itemsMap.values()].sort((a, b) => a.display_name.localeCompare(b.display_name));
  const templates = buildTemplates(book);
  console.log(`extracted ${items.length} unique items across ${templates.length} templates`);

  const resolvedOut = path.resolve(process.cwd(), outDir);
  await mkdir(resolvedOut, { recursive: true });

  await writeFile(path.join(resolvedOut, 'parameters.yaml'), renderParametersYaml(), 'utf8');
  await writeFile(path.join(resolvedOut, 'items.yaml'), renderItemsYaml(items), 'utf8');
  await writeFile(path.join(resolvedOut, 'templates.yaml'), renderTemplatesYaml(templates), 'utf8');

  console.log(`wrote draft YAML to ${resolvedOut}`);
  console.log('next: review the REVIEW markers and adjust, then run `npm run seed:local`.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
