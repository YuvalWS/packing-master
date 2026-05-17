import { describe, expect, it, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, type Catalog } from '../../src/lib/seed/load.js';
import { generate } from '../../src/lib/rules/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');

let catalog: Catalog;

beforeAll(async () => {
  catalog = await loadCatalog(FIXTURES);
});

describe('generate — singleton constraint', () => {
  it('throws when no accommodation is active', () => {
    expect(() =>
      generate({
        items: catalog.items,
        parameters: catalog.parameters,
        userParams: [],
        startISO: '2025-01-06',
        endISO: '2025-01-07'
      })
    ).toThrow(/singleton/);
  });

  it('throws when two accommodations active', () => {
    expect(() =>
      generate({
        items: catalog.items,
        parameters: catalog.parameters,
        userParams: ['accom_a', 'accom_b'],
        startISO: '2025-01-06',
        endISO: '2025-01-07'
      })
    ).toThrow(/singleton/);
  });

  it('succeeds with exactly one accommodation', () => {
    const r = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a'],
      startISO: '2025-01-06',
      endISO: '2025-01-07'
    });
    expect(r.items.length).toBeGreaterThan(0);
  });
});

describe('generate — minimal trip (Mon-Tue, accom_a only)', () => {
  it('returns only items whose condition is true (and skips param-gated items)', () => {
    const r = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a'],
      startISO: '2025-01-06', // Mon
      endISO: '2025-01-07' // Tue
    });
    const ids = r.items.map((i) => i.itemId).sort();
    // include_when:true items: item_always, item_per_day, item_per_two_days, item_kit
    // include_when:not(plan_b) is true when plan_b inactive → included
    // item_when_env_a: env_a inactive → excluded
    // item_when_accom_a_and_plan_a: plan_a inactive → excluded
    // item_when_env_a_or_env_b: env_a/b inactive → excluded
    // item_complex_nested: env_a/b inactive → excluded
    // item_optional: env_b inactive → excluded
    // item_per_shabbat: no shabbat in Mon-Tue → excluded
    expect(ids).toEqual([
      'item_always',
      'item_kit',
      'item_per_day',
      'item_per_two_days',
      'item_when_not_plan_b'
    ]);
  });

  it('shortTrip derived param is auto-applied', () => {
    const r = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a'],
      startISO: '2025-01-06',
      endISO: '2025-01-07'
    });
    expect(r.activeParams).toContain('derived_short_trip');
    expect(r.derived.shortTrip).toBe(true);
  });
});

describe('generate — flipping params changes only affected items', () => {
  const baseArgs = (extra: string[] = []) => ({
    items: catalog.items,
    parameters: catalog.parameters,
    userParams: ['accom_a', ...extra],
    startISO: '2025-01-06',
    endISO: '2025-01-07'
  });

  it('adding env_a turns on item_when_env_a, item_when_env_a_or_env_b, item_complex_nested(*)', () => {
    const baseIds = new Set(generate(baseArgs()).items.map((i) => i.itemId));
    const withEnvA = new Set(generate(baseArgs(['env_a'])).items.map((i) => i.itemId));

    const added = [...withEnvA].filter((id) => !baseIds.has(id)).sort();
    // complex_nested requires (env_a OR env_b) AND (plan_a OR plan_b); plan_a/b still inactive → still excluded
    expect(added).toEqual(['item_when_env_a', 'item_when_env_a_or_env_b']);
  });

  it('adding plan_b turns off item_when_not_plan_b', () => {
    const before = new Set(generate(baseArgs()).items.map((i) => i.itemId));
    const after = new Set(generate(baseArgs(['plan_b'])).items.map((i) => i.itemId));
    expect(before.has('item_when_not_plan_b')).toBe(true);
    expect(after.has('item_when_not_plan_b')).toBe(false);
  });

  it('adding env_b turns on optional item', () => {
    const after = new Set(generate(baseArgs(['env_b'])).items.map((i) => i.itemId));
    expect(after.has('item_optional')).toBe(true);
  });
});

describe('generate — quantity scales with trip length', () => {
  it('per_day item count = days', () => {
    const r2 = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a'],
      startISO: '2025-01-06',
      endISO: '2025-01-12' // 7 days
    });
    const perDay = r2.items.find((i) => i.itemId === 'item_per_day');
    expect(perDay?.count).toBe(7);
  });

  it('per_two_days count = ceil(days/2)', () => {
    const r = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a'],
      startISO: '2025-01-06',
      endISO: '2025-01-12' // 7 days → ceil(7/2)=4
    });
    expect(r.items.find((i) => i.itemId === 'item_per_two_days')?.count).toBe(4);
  });
});

describe('generate — shabbat-gated items', () => {
  it('item_per_shabbat appears with correct count when shabbat falls in trip', () => {
    const r = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a'],
      startISO: '2025-01-01', // Wed
      endISO: '2025-01-07' // Tue → 1 shabbat
    });
    const shab = r.items.find((i) => i.itemId === 'item_per_shabbat');
    expect(shab).toBeDefined();
    expect(shab?.count).toBe(1);
  });
});

describe('generate — complex nested condition', () => {
  it('requires (env_a OR env_b) AND (plan_a OR plan_b)', () => {
    const r = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a', 'env_a', 'plan_a'],
      startISO: '2025-01-06',
      endISO: '2025-01-12'
    });
    const c = r.items.find((i) => i.itemId === 'item_complex_nested');
    expect(c).toBeDefined();
    // days_plus { add:1, min:2 } on 7 days → 8
    expect(c?.count).toBe(8);
  });
});

describe('generate — ruleSnapshot is included', () => {
  it('each generated item carries its source rule', () => {
    const r = generate({
      items: catalog.items,
      parameters: catalog.parameters,
      userParams: ['accom_a'],
      startISO: '2025-01-06',
      endISO: '2025-01-07'
    });
    for (const gi of r.items) {
      expect(gi.ruleSnapshot.include_when).toBeDefined();
      expect(gi.ruleSnapshot.quantity).toBeDefined();
    }
  });
});
