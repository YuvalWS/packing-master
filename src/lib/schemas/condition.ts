import { z } from 'zod';

// Discriminated union for the condition DSL. Recursive via z.lazy.
//
// Forms:
//   true                                     — always include
//   "param_id"                               — include if that parameter is active
//   { and: [...] } / { or: [...] }           — composition
//   { not: cond }                            — negation
//   { eq: ["path", value] }                  — context value equals
//   { gte: ["path", value] }                 — context value >=
//   { any_param: [ids...] }                  — any of the params active
//   { all_params: [ids...] }                 — all of the params active
//   { includes_shabbat: true }               — derived helper
//   { person: "id" }                         — that person is travelling
//   { kind: "baby" }                         — at least one traveler of that kind

export type Condition =
  | true
  | string
  | { and: Condition[] }
  | { or: Condition[] }
  | { not: Condition }
  | { eq: [string, string | number | boolean] }
  | { gte: [string, number] }
  | { any_param: string[] }
  | { all_params: string[] }
  | { includes_shabbat: true }
  | { person: string }
  | { kind: 'adult' | 'kid' | 'baby' };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.literal(true),
    z.string().min(1),
    z.object({ and: z.array(ConditionSchema) }).strict(),
    z.object({ or: z.array(ConditionSchema) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z
      .object({
        eq: z.tuple([z.string().min(1), z.union([z.string(), z.number(), z.boolean()])])
      })
      .strict(),
    z.object({ gte: z.tuple([z.string().min(1), z.number()]) }).strict(),
    z.object({ any_param: z.array(z.string().min(1)) }).strict(),
    z.object({ all_params: z.array(z.string().min(1)) }).strict(),
    z.object({ includes_shabbat: z.literal(true) }).strict(),
    z.object({ person: z.string().min(1) }).strict(),
    z.object({ kind: z.enum(['adult', 'kid', 'baby']) }).strict()
  ])
);
