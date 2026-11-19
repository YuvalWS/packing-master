import { z } from 'zod';
import { ItemSchema, ItemScope, KitComponentSchema } from '../item.js';
import { PersonKind } from '../person.js';
import { TemplateSchema } from '../template.js';
import { ConditionSchema } from '../condition.js';
import { QuantitySchema } from '../quantity.js';

const Id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case ascii');
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const nonEmpty = (v: object) => Object.keys(v).length > 0;

export const ItemCreateRequest = ItemSchema;

// null clears an optional field.
export const ItemPatchRequest = z
  .object({
    display_name: z.string().min(1).max(255),
    category: z.string().min(1).max(64).nullable(),
    default_bag: z.string().min(1).max(64).nullable(),
    per: ItemScope,
    split: z.boolean(),
    person_id: Id.nullable(),
    is_optional: z.boolean(),
    is_kit: z.boolean(),
    kit_contents: z.array(KitComponentSchema).nullable(),
    include_when: ConditionSchema,
    quantity: QuantitySchema,
    notes: z.string().nullable(),
    archived: z.boolean()
  })
  .partial()
  .strict()
  .refine(nonEmpty, { message: 'at least one field required' });
export type ItemPatchRequest = z.infer<typeof ItemPatchRequest>;

export const TemplateCreateRequest = TemplateSchema;

export const TemplatePatchRequest = z
  .object({
    display_name: z.string().min(1).max(255),
    default_parameters: z.array(z.string().min(1)),
    default_extras: z.record(z.unknown()).nullable(),
    sort_order: z.number().int()
  })
  .partial()
  .strict()
  .refine(nonEmpty, { message: 'at least one field required' });
export type TemplatePatchRequest = z.infer<typeof TemplatePatchRequest>;

const EditableCategory = z.enum(['accommodation', 'environment', 'day_plans']);

export const ParameterCreateRequest = z
  .object({
    id: Id,
    display_name: z.string().min(1).max(255),
    category: EditableCategory,
    sort_order: z.number().int().default(0)
  })
  .strict();
export type ParameterCreateRequest = z.infer<typeof ParameterCreateRequest>;

export const ParameterPatchRequest = z
  .object({
    display_name: z.string().min(1).max(255),
    category: EditableCategory,
    sort_order: z.number().int()
  })
  .partial()
  .strict()
  .refine(nonEmpty, { message: 'at least one field required' });
export type ParameterPatchRequest = z.infer<typeof ParameterPatchRequest>;

export const PreviewRequest = z
  .object({
    item_id: Id.optional(),
    item: ItemSchema.optional(),
    trip_id: z.number().int().positive().optional(),
    start_date: IsoDate.optional(),
    end_date: IsoDate.optional(),
    parameters: z.array(z.string().min(1)).optional(),
    extras: z.record(z.unknown()).optional(),
    travelers: z.array(Id).optional()
  })
  .strict()
  .refine((v) => (v.item_id === undefined) !== (v.item === undefined), {
    message: 'give exactly one of item_id or item'
  })
  .refine(
    (v) =>
      v.trip_id !== undefined
        ? v.start_date === undefined && v.end_date === undefined && v.parameters === undefined
        : v.start_date !== undefined && v.end_date !== undefined && v.parameters !== undefined,
    { message: 'give trip_id, or start_date + end_date + parameters' }
  )
  .refine((v) => v.trip_id === undefined || v.travelers === undefined, {
    message: 'travelers come from the trip when trip_id is given'
  });
export type PreviewRequest = z.infer<typeof PreviewRequest>;

export const PersonCreateRequest = z
  .object({
    id: Id,
    display_name: z.string().min(1).max(255),
    kind: PersonKind,
    sort_order: z.number().int().default(0)
  })
  .strict();
export type PersonCreateRequest = z.infer<typeof PersonCreateRequest>;

export const PersonPatchRequest = z
  .object({
    display_name: z.string().min(1).max(255),
    kind: PersonKind,
    sort_order: z.number().int(),
    archived: z.boolean()
  })
  .partial()
  .strict()
  .refine(nonEmpty, { message: 'at least one field required' });
export type PersonPatchRequest = z.infer<typeof PersonPatchRequest>;
