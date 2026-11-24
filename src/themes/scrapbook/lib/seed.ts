/**
 * Deterministic "randomness" for prerender-safe scrapbook rotations and offsets.
 * Same id in, same number out, on the server and the client.
 */
export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** A value in [-range, range] derived from `id`. */
export function jitter(id: string, range: number, salt = ""): number {
  return Number(((hash(id + salt) * 2 - 1) * range).toFixed(2));
}
