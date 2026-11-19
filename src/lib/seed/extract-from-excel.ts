import * as xlsx from 'xlsx';
import yaml from 'js-yaml';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ExtractConfigSchema } from '../schemas/extract-config.js';
import {
  extract,
  renderItemsYaml,
  renderParametersYaml,
  renderReport,
  renderTemplatesYaml,
  type Grid
} from './extract.js';

// Authoring tool. Reads the spreadsheet at PACKING_EXCEL_PATH plus a mapping
// config (which sheet/column holds what) and writes a draft catalog as YAML.
// The output is a starting point: `# REVIEW:` comments mark every guess, and
// extract-report.txt lists what was dropped so nothing goes missing silently.
//
//   usage: tsx src/lib/seed/extract-from-excel.ts [config] [out-dir]

function sheetGrid(sheet: xlsx.WorkSheet): Grid {
  const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  return rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))));
}

async function main() {
  const excelPath = process.env.PACKING_EXCEL_PATH;
  const configPath = process.argv[2] ?? 'seed/local/extract-config.yaml';
  const outDir = process.argv[3] ?? 'seed/local';

  if (!excelPath) {
    console.error('PACKING_EXCEL_PATH env var is required');
    process.exit(1);
  }
  if (!existsSync(excelPath)) {
    console.error(`spreadsheet not found at ${excelPath}`);
    process.exit(1);
  }
  if (!existsSync(configPath)) {
    console.error(`extractor config not found at ${configPath}`);
    process.exit(1);
  }

  const config = ExtractConfigSchema.parse(yaml.load(await readFile(configPath, 'utf8')));

  console.log(`reading ${excelPath}`);
  // The ESM build of SheetJS has no fs access; hand it the bytes instead.
  const book = xlsx.read(await readFile(excelPath), { type: 'buffer' });
  const grids = new Map<string, Grid>();
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (sheet) grids.set(name, sheetGrid(sheet));
  }
  console.log(`workbook has ${grids.size} sheets; config maps ${config.sheets.length}`);

  const result = extract(grids, config);
  console.log(
    `extracted ${result.items.length} items from ${result.occurrences.length} cells ` +
      `(${result.report.unmapped.length} cells in unmapped columns)`
  );
  if (result.report.unknownParameters.length) {
    console.warn(
      `warning: undeclared parameters referenced: ${result.report.unknownParameters.join(', ')}`
    );
  }

  const resolvedOut = path.resolve(process.cwd(), outDir);
  await mkdir(resolvedOut, { recursive: true });
  await writeFile(path.join(resolvedOut, 'parameters.yaml'), renderParametersYaml(config), 'utf8');
  await writeFile(path.join(resolvedOut, 'items.yaml'), renderItemsYaml(result.items), 'utf8');
  await writeFile(path.join(resolvedOut, 'templates.yaml'), renderTemplatesYaml(config), 'utf8');
  await writeFile(path.join(resolvedOut, 'extract-report.txt'), renderReport(result), 'utf8');

  console.log(`wrote catalog + extract-report.txt to ${resolvedOut}`);
  console.log('next: review the REVIEW markers, then run `npm run seed:local`.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
