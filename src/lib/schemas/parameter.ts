import { z } from 'zod';

export const ParameterCategory = z.enum([
  'accommodation',
  'environment',
  'day_plans',
  'derived',
  'misc'
]);
export type ParameterCategory = z.infer<typeof ParameterCategory>;

const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case ascii');

export const ParameterSchema = z
  .object({
    id: IdSchema,
    display_name: z.string().min(1).max(255),
    category: ParameterCategory,
    is_singleton: z.boolean().default(false),
    is_derived: z.boolean().default(false),
    sort_order: z.number().int().default(0)
  })
  .strict();

export type Parameter = z.infer<typeof ParameterSchema>;

export const ParametersFileSchema = z.object({
  parameters: z.array(ParameterSchema)
});
export type ParametersFile = z.infer<typeof ParametersFileSchema>;
