/**
 * The LLM is asked for JSON but nothing guarantees it fills in every field
 * with a non-empty string — a model can emit `{"title": null}` or omit a
 * key entirely while still producing syntactically valid JSON. Rather than
 * threading a full schema validator through every agent, this checks the
 * handful of fields every finding/suggestion actually renders, so a
 * malformed entry is dropped instead of surfacing as "undefined" in the UI.
 */
export function hasNonEmptyStrings<T extends object>(obj: T, keys: (keyof T)[]): boolean {
  return keys.every((key) => {
    const value = obj[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}
