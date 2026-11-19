import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { ParametersFileSchema, type Parameter } from '../schemas/parameter.js';
import { ItemsFileSchema, type Item } from '../schemas/item.js';
import { TemplatesFileSchema, type Template } from '../schemas/template.js';
import { PeopleFileSchema, type Person } from '../schemas/person.js';
import { existsSync } from 'node:fs';

export interface Catalog {
  parameters: Parameter[];
  items: Item[];
  templates: Template[];
  /** Optional people.yaml (DESIGN.md 13); person-tied items need their people. */
  people: Person[];
}

async function loadYaml<T>(file: string): Promise<unknown> {
  const raw = await readFile(file, 'utf8');
  return yaml.load(raw);
}

export async function loadCatalog(dir: string): Promise<Catalog> {
  const [paramsRaw, itemsRaw, templatesRaw] = await Promise.all([
    loadYaml(path.join(dir, 'parameters.yaml')),
    loadYaml(path.join(dir, 'items.yaml')),
    loadYaml(path.join(dir, 'templates.yaml'))
  ]);

  const parameters = ParametersFileSchema.parse(paramsRaw).parameters;
  const items = ItemsFileSchema.parse(itemsRaw).items;
  const templates = TemplatesFileSchema.parse(templatesRaw).templates;

  const peopleFile = path.join(dir, 'people.yaml');
  const people = existsSync(peopleFile)
    ? PeopleFileSchema.parse(await loadYaml(peopleFile)).people
    : [];

  return { parameters, items, templates, people };
}
