import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';
import { ParametersFileSchema } from '../schemas/parameter.js';
import { ItemsFileSchema } from '../schemas/item.js';
import { TemplatesFileSchema } from '../schemas/template.js';

// Writes a running install's live catalog (GET /api/catalog) to seed YAML files, so the
// committed-shape YAML stays an up-to-date copy of what the agent or editor changed.
// Behind Cloudflare Access set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.
async function main() {
  const base = process.argv[2];
  const dir = path.resolve(process.cwd(), process.argv[3] ?? 'seed/local');
  if (!base) {
    console.error('usage: tsx src/lib/seed/pull.ts <base-url> [dir=seed/local]');
    process.exit(1);
  }
  const headers: Record<string, string> = {};
  if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
  }
  const res = await fetch(new URL('/api/catalog', base), { headers });
  if (!res.ok) throw new Error(`GET /api/catalog: HTTP ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;

  const files = {
    'parameters.yaml': ParametersFileSchema.parse({ parameters: body.parameters }),
    'items.yaml': ItemsFileSchema.parse({ items: body.items }),
    'templates.yaml': TemplatesFileSchema.parse({ templates: body.templates })
  };
  await mkdir(dir, { recursive: true });
  const header = `# Pulled from ${base} on ${new Date().toISOString()} (npm run catalog:pull).\n# The live database is the source of truth; edit there, then pull again.\n\n`;
  for (const [name, data] of Object.entries(files)) {
    await writeFile(path.join(dir, name), header + yaml.dump(data, { lineWidth: 120, noRefs: true }));
  }
  console.log(
    `wrote ${dir}: ${files['parameters.yaml'].parameters.length} parameters, ` +
      `${files['items.yaml'].items.length} items, ${files['templates.yaml'].templates.length} templates`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
