export function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}
