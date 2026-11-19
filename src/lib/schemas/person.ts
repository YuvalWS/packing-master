import { z } from 'zod';

export const PersonKind = z.enum(['adult', 'kid', 'baby']);
export type PersonKind = z.infer<typeof PersonKind>;

const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case ascii');

export const PersonSchema = z
  .object({
    id: IdSchema,
    display_name: z.string().min(1).max(255),
    kind: PersonKind,
    sort_order: z.number().int().default(0)
  })
  .strict();
export type Person = z.infer<typeof PersonSchema>;

export const PeopleFileSchema = z.object({
  people: z.array(PersonSchema)
});
export type PeopleFile = z.infer<typeof PeopleFileSchema>;
