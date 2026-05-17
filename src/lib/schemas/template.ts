import { z } from 'zod';

const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case ascii');

export const TemplateSchema = z
  .object({
    id: IdSchema,
    display_name: z.string().min(1).max(255),
    default_parameters: z.array(z.string().min(1)),
    default_extras: z.record(z.unknown()).optional(),
    sort_order: z.number().int().default(0)
  })
  .strict();
export type Template = z.infer<typeof TemplateSchema>;

export const TemplatesFileSchema = z.object({
  templates: z.array(TemplateSchema)
});
export type TemplatesFile = z.infer<typeof TemplatesFileSchema>;
