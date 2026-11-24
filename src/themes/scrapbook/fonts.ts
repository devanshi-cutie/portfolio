import { Fraunces, Instrument_Sans } from "next/font/google";

/**
 * Display: Fraunces (variable, optical sizing; italic for accents) for the
 * name and headings. Body/UI: Instrument Sans. Both from the legacy Pink City
 * prototype. No script face.
 */
export const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

export const body = Instrument_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-instrument-sans",
});

/** next/font `.variable` classes: define the two font-family variables. */
export const fontVariables = `${display.variable} ${body.variable}`;

export const fontStacks = {
  display: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
  body: "var(--font-instrument-sans), ui-sans-serif, system-ui, sans-serif",
} as const;
