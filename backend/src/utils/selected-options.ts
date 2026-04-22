export type SelectedOptions = Record<string, string | string[]>;

export function normalizeSelectedOptions(input: unknown): SelectedOptions {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const result: SelectedOptions = {};

  for (const [groupKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") {
      result[groupKey] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const normalized = Array.from(
        new Set(value.filter((item): item is string => typeof item === "string")),
      ).sort();
      result[groupKey] = normalized;
    }
  }

  return result;
}

export function hashSelectedOptions(options: SelectedOptions): string {
  const orderedKeys = Object.keys(options).sort();
  const stableObject: Record<string, string | string[]> = {};

  for (const key of orderedKeys) {
    const value = options[key];
    stableObject[key] = Array.isArray(value) ? [...value].sort() : value;
  }

  return JSON.stringify(stableObject);
}
