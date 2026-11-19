// Columns declared JSON in the schema. MySQL reports them as JSON and mysql2 parses them;
// MariaDB stores JSON as LONGTEXT, so the pool parses these by name (see pool.ts).
export const JSON_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  items: ['kit_contents', 'include_when', 'quantity'],
  templates: ['default_parameters', 'default_extras'],
  trips: ['context', 'travelers'],
  trip_items: ['bag_distribution', 'rule_snapshot']
};

// mysql2's typeCast only sees the (possibly aliased) column name, so match by name:
// these names are used by JSON columns only.
const NAMES = new Set(Object.values(JSON_COLUMNS).flat());

export function isJsonColumnName(column: string): boolean {
  return NAMES.has(column);
}

export function isJsonColumn(table: string, column: string): boolean {
  return JSON_COLUMNS[table]?.includes(column) ?? false;
}
