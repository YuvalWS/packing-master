import { z } from 'zod';
import { ConditionSchema } from './condition.js';
import { QuantitySchema } from './quantity.js';

const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case ascii');

export const KitComponentSchema = z
  .object({
    id: IdSchema,
    display_name: z.string().min(1).max(255),
    default_count: z.number().int().positive().default(1)
  })
  .strict();
export type KitComponent = z.infer<typeof KitComponentSchema>;

export const ItemSchema = z
  .object({
    id: IdSchema,
    display_name: z.string().min(1).max(255),
    category: z.string().min(1).max(64).optional(),
    default_bag: z.string().min(1).max(64).optional(),
    is_shared: z.boolean().default(false),
    is_optional: z.boolean().default(false),
    is_kit: z.boolean().default(false),
    kit_contents: z.array(KitComponentSchema).optional(),
    include_when: ConditionSchema,
    quantity: QuantitySchema,
    notes: z.string().optional()
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.is_kit && (!item.kit_contents || item.kit_contents.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'is_kit=true requires non-empty kit_contents'
      });
    }
    if (!item.is_kit && item.kit_contents && item.kit_contents.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'kit_contents provided but is_kit is false'
      });
    }
  });

export type Item = z.infer<typeof ItemSchema>;

export const ItemsFileSchema = z.object({
  items: z.array(ItemSchema)
});
export type ItemsFile = z.infer<typeof ItemsFileSchema>;
