import { z } from 'zod';

const ItemId = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const TripItemPatchRequest = z
  .object({
    count: z.number().int().nonnegative().optional(),
    is_checked: z.boolean().optional(),
    bag_distribution: z.record(z.unknown()).nullable().optional(),
    notes: z.string().nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field required' });
export type TripItemPatchRequest = z.infer<typeof TripItemPatchRequest>;

export const TripItemAddCatalogRequest = z
  .object({
    item_id: ItemId,
    // For a per-person item, whose row this is.
    person_id: ItemId.optional(),
    count: z.number().int().positive().optional(),
    bag_distribution: z.record(z.unknown()).optional(),
    notes: z.string().optional()
  })
  .strict();
export type TripItemAddCatalogRequest = z.infer<typeof TripItemAddCatalogRequest>;

export const TripItemAddFreeTextRequest = z
  .object({
    display_name: z.string().min(1).max(255),
    count: z.number().int().positive().optional(),
    bag_distribution: z.record(z.unknown()).optional(),
    notes: z.string().optional()
  })
  .strict();
export type TripItemAddFreeTextRequest = z.infer<typeof TripItemAddFreeTextRequest>;

export const TripItemAddRequest = z.union([
  TripItemAddCatalogRequest,
  TripItemAddFreeTextRequest
]);
export type TripItemAddRequest = z.infer<typeof TripItemAddRequest>;
