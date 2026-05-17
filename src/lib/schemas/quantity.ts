import { z } from 'zod';

// Quantity formula DSL — what count to produce for an item on a given trip.

export type QuantityFormula =
  | { fixed: number }
  | { per_day: number }
  | { per_n_days: { n: number; min?: number } }
  | { per_weekday: number }
  | { per_shabbat: number }
  | { days_plus: { add: number; min?: number } };

export const QuantitySchema: z.ZodType<QuantityFormula> = z.union([
  z.object({ fixed: z.number().int().nonnegative() }).strict(),
  z.object({ per_day: z.number().int().positive() }).strict(),
  z
    .object({
      per_n_days: z
        .object({
          n: z.number().int().positive(),
          min: z.number().int().nonnegative().optional()
        })
        .strict()
    })
    .strict(),
  z.object({ per_weekday: z.number().int().positive() }).strict(),
  z.object({ per_shabbat: z.number().int().positive() }).strict(),
  z
    .object({
      days_plus: z
        .object({
          add: z.number().int(),
          min: z.number().int().nonnegative().optional()
        })
        .strict()
    })
    .strict()
]);
