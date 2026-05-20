import { z } from 'zod';

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const ParamId = z.string().regex(/^[a-z][a-z0-9_]*$/);
const TemplateId = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const TripCreateRequest = z
  .object({
    name: z.string().min(1).max(255).optional(),
    template_id: TemplateId.optional(),
    start_date: IsoDate,
    end_date: IsoDate,
    destination: z.string().min(1).max(255).optional(),
    parameters: z.array(ParamId),
    extras: z.record(z.unknown()).optional(),
    travelers: z.record(z.unknown()).optional()
  })
  .strict()
  .refine((v) => v.start_date <= v.end_date, {
    message: 'start_date must be on or before end_date',
    path: ['end_date']
  });
export type TripCreateRequest = z.infer<typeof TripCreateRequest>;

export const TripPatchRequest = z
  .object({
    name: z.string().min(1).max(255).nullable().optional(),
    template_id: TemplateId.nullable().optional(),
    start_date: IsoDate.optional(),
    end_date: IsoDate.optional(),
    destination: z.string().min(1).max(255).nullable().optional(),
    parameters: z.array(ParamId).optional(),
    extras: z.record(z.unknown()).optional(),
    travelers: z.record(z.unknown()).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field required' })
  .refine(
    (v) => v.start_date === undefined || v.end_date === undefined || v.start_date <= v.end_date,
    { message: 'start_date must be on or before end_date', path: ['end_date'] }
  );
export type TripPatchRequest = z.infer<typeof TripPatchRequest>;
