import { z } from 'zod';

const ItemId = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const RemoveItemKey = z.union([
  // Without person_id: every rule-generated row of the item.
  z.object({ item_id: ItemId, person_id: z.string().optional() }).strict(),
  z.object({ row_id: z.number().int().positive() }).strict()
]);
export type RemoveItemKey = z.infer<typeof RemoveItemKey>;

// For the items a settings change left behind (DESIGN.md 14.3): remove them, keep them as
// manual items, or keep them as manual and checked ("mark packed").
export const RegenerateRequest = z
  .object({
    remove_item_keys: z.array(RemoveItemKey),
    keep_item_keys: z.array(RemoveItemKey).optional(),
    pack_item_keys: z.array(RemoveItemKey).optional()
  })
  .strict();
export type RegenerateRequest = z.infer<typeof RegenerateRequest>;
