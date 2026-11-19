import { z } from 'zod';

const ItemId = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const RemoveItemKey = z.union([
  // Without person_id: every rule-generated row of the item.
  z.object({ item_id: ItemId, person_id: z.string().optional() }).strict(),
  z.object({ row_id: z.number().int().positive() }).strict()
]);
export type RemoveItemKey = z.infer<typeof RemoveItemKey>;

export const RegenerateRequest = z
  .object({
    remove_item_keys: z.array(RemoveItemKey)
  })
  .strict();
export type RegenerateRequest = z.infer<typeof RegenerateRequest>;
