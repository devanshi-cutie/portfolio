/** Stagger helper (server-safe): 50ms steps, capped so a cascade never exceeds 300ms. */
export const stagger = (i: number, step = 0.05, cap = 0.3) => Math.min(i * step, cap);
