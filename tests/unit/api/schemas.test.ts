import { describe, expect, it } from 'vitest';
import { TripCreateRequest, TripPatchRequest } from '../../../src/lib/schemas/api/trip.js';
import {
  TripItemPatchRequest,
  TripItemAddRequest
} from '../../../src/lib/schemas/api/trip-item.js';
import { RegenerateRequest } from '../../../src/lib/schemas/api/regenerate.js';

describe('TripCreateRequest', () => {
  it('accepts a minimal valid create', () => {
    const r = TripCreateRequest.safeParse({
      start_date: '2025-01-01',
      end_date: '2025-01-07',
      parameters: ['accom_a']
    });
    expect(r.success).toBe(true);
  });
  it('rejects end before start', () => {
    const r = TripCreateRequest.safeParse({
      start_date: '2025-01-10',
      end_date: '2025-01-01',
      parameters: []
    });
    expect(r.success).toBe(false);
  });
  it('rejects bad date format', () => {
    const r = TripCreateRequest.safeParse({
      start_date: '2025/01/01',
      end_date: '2025-01-07',
      parameters: []
    });
    expect(r.success).toBe(false);
  });
});

describe('TripPatchRequest', () => {
  it('accepts a name-only patch', () => {
    expect(TripPatchRequest.safeParse({ name: 'new' }).success).toBe(true);
  });
  it('rejects an empty patch', () => {
    expect(TripPatchRequest.safeParse({}).success).toBe(false);
  });
});

describe('TripItemPatchRequest', () => {
  it('accepts count-only patch', () => {
    expect(TripItemPatchRequest.safeParse({ count: 3 }).success).toBe(true);
  });
  it('rejects empty patch', () => {
    expect(TripItemPatchRequest.safeParse({}).success).toBe(false);
  });
  it('rejects negative count', () => {
    expect(TripItemPatchRequest.safeParse({ count: -1 }).success).toBe(false);
  });
});

describe('TripItemAddRequest', () => {
  it('accepts catalog variant', () => {
    const r = TripItemAddRequest.safeParse({ item_id: 'item_a', count: 2 });
    expect(r.success).toBe(true);
  });
  it('accepts free-text variant', () => {
    const r = TripItemAddRequest.safeParse({ display_name: 'Custom', count: 1 });
    expect(r.success).toBe(true);
  });
  it('rejects a payload with neither', () => {
    const r = TripItemAddRequest.safeParse({ count: 1 });
    expect(r.success).toBe(false);
  });
});

describe('RegenerateRequest', () => {
  it('accepts mixed key shapes', () => {
    const r = RegenerateRequest.safeParse({
      remove_item_keys: [{ item_id: 'item_a' }, { row_id: 7 }]
    });
    expect(r.success).toBe(true);
  });
  it('accepts empty array', () => {
    expect(RegenerateRequest.safeParse({ remove_item_keys: [] }).success).toBe(true);
  });
  it('rejects unknown key shape', () => {
    const r = RegenerateRequest.safeParse({ remove_item_keys: [{ wat: 1 }] });
    expect(r.success).toBe(false);
  });
});
