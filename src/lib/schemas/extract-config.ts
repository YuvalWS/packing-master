import { z } from 'zod';
import { ConditionSchema } from './condition.js';
import { QuantitySchema } from './quantity.js';
import { ParameterSchema } from './parameter.js';

// Configuration for the Excel extractor (src/lib/seed/extract-from-excel.ts).
//
// The spreadsheet is a free-form grid: every sheet holds several column blocks,
// each headed by a category label, and the same item recurs across sheets with
// different quantities. None of that is inferable, so the mapping from
// (sheet, column, row-range) to (category, bag, parameters) is declared here.
// The config carries the display strings; the extractor stays language-neutral.

const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case ascii');

export const ColumnRangeSchema = z
  .object({
    index: z.number().int().nonnegative(),
    // Inclusive 0-based row bounds. A column that holds two stacked blocks is
    // declared as two ranges with the same index.
    from_row: z.number().int().nonnegative().optional(),
    to_row: z.number().int().nonnegative().optional(),
    category: z.string().min(1).optional(),
    bag: z.string().min(1).optional(),
    parameters: z.array(z.string().min(1)).default([]),
    is_optional: z.boolean().default(false),
    is_shared: z.boolean().default(false),
    quantity: QuantitySchema.optional()
  })
  .strict();
export type ColumnRange = z.infer<typeof ColumnRangeSchema>;

export const TableLayoutSchema = z
  .object({
    header_rows: z.number().int().nonnegative().default(1),
    category_column: z.number().int().nonnegative(),
    item_column: z.number().int().nonnegative(),
    count_column: z.number().int().nonnegative().optional(),
    notes_column: z.number().int().nonnegative().optional(),
    bag: z.string().min(1).optional(),
    parameters: z.array(z.string().min(1)).default([]),
    // Per-category overrides keyed by the category cell text.
    category_parameters: z.record(z.array(z.string().min(1))).default({}),
    category_bags: z.record(z.string().min(1)).default({})
  })
  .strict();
export type TableLayout = z.infer<typeof TableLayoutSchema>;

export const SheetConfigSchema = z
  .object({
    name: z.string().min(1),
    // grid  — column blocks with header labels (the common case)
    // table — one row per item with category/item/count columns
    mode: z.enum(['grid', 'table']).default('grid'),
    skip: z.boolean().default(false),
    // Parameters every item on this sheet contributes, on top of per-column ones.
    parameters: z.array(z.string().min(1)).default([]),
    template: z
      .object({
        id: IdSchema,
        display_name: z.string().min(1).max(255),
        default_parameters: z.array(z.string().min(1)),
        sort_order: z.number().int().default(0)
      })
      .strict()
      .optional(),
    columns: z.array(ColumnRangeSchema).default([]),
    table: TableLayoutSchema.optional()
  })
  .strict();
export type SheetConfig = z.infer<typeof SheetConfigSchema>;

export const ItemOverrideSchema = z
  .object({
    id: IdSchema.optional(),
    skip: z.boolean().optional(),
    display_name: z.string().min(1).max(255).optional(),
    category: z.string().min(1).optional(),
    default_bag: z.string().min(1).optional(),
    is_optional: z.boolean().optional(),
    is_shared: z.boolean().optional(),
    is_kit: z.boolean().optional(),
    kit_contents: z
      .array(
        z
          .object({
            id: IdSchema,
            display_name: z.string().min(1).max(255),
            default_count: z.number().int().positive().default(1)
          })
          .strict()
      )
      .optional(),
    include_when: ConditionSchema.optional(),
    quantity: QuantitySchema.optional(),
    notes: z.string().optional()
  })
  .strict();
export type ItemOverride = z.infer<typeof ItemOverrideSchema>;

export const ExtractConfigSchema = z
  .object({
    parameters: z.array(ParameterSchema),
    // An item that shows up in at least this many templated sheets is treated
    // as a base item (include_when: true) instead of being tied to parameters.
    base_threshold: z.number().int().positive().default(4),
    ignore: z
      .object({
        values: z.array(z.string()).default([]),
        patterns: z.array(z.string()).default([])
      })
      .strict()
      .default({ values: [], patterns: [] }),
    // Spelling variants -> canonical display name, applied after count parsing.
    aliases: z.record(z.string().min(1)).default({}),
    // Canonical display name -> quantity formula. Wins over counts read from cells.
    quantity_rules: z.record(QuantitySchema).default({}),
    item_overrides: z.record(ItemOverrideSchema).default({}),
    sheets: z.array(SheetConfigSchema)
  })
  .strict();
export type ExtractConfig = z.infer<typeof ExtractConfigSchema>;
