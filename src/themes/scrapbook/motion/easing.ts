/** Motion rules: ease-out to enter, ease-in to leave, in-out to move. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.7, 0, 0.84, 0] as const;
export const EASE_MOVE = [0.65, 0, 0.35, 1] as const;
/** Snappy, interruptible spring for reversible UI (pills, toggles). */
export const SPRING_UI = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;
