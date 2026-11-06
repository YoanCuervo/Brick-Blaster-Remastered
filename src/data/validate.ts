export class DataError extends Error {
  constructor(path: string, expected: string) {
    super(`${path}: expected ${expected}`);
    this.name = "DataError";
  }
}

export function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DataError(path, "an object");
  }
  return value as Record<string, unknown>;
}

export function int(value: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new DataError(path, `an integer in [${min}, ${max}]`);
  }
  return value as number;
}

export function str(value: unknown, path: string): string {
  if (typeof value !== "string") throw new DataError(path, "a string");
  return value;
}

export function list<T>(
  value: unknown,
  path: string,
  length: number | undefined,
  item: (v: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value) || (length !== undefined && value.length !== length)) {
    throw new DataError(path, length === undefined ? "an array" : `an array of ${length}`);
  }
  return value.map((v, i) => item(v, `${path}[${i}]`));
}
