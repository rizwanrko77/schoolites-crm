export type SqlValue = string | number | boolean | null | string[];

/** Appends a bound parameter and returns its `$n` placeholder. */
export function pushParam(params: SqlValue[], value: SqlValue): string {
  params.push(value);
  return `$${params.length}`;
}

/** LIKE pattern that treats `%`, `_`, and `\` in user input as literals. */
export function containsPattern(raw: string): string {
  return `%${raw.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Deduped non-empty ids safe to bind as a text array. */
export function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id.length > 255) continue;
    seen.add(id);
  }
  return [...seen];
}
