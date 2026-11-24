/**
 * Shared helpers for the CLI scripts (seed).
 *
 * Scripts run outside Next.js, so they load `.env.local` then `.env` themselves.
 * Values already in `process.env` win (dotenv never overrides), and `.env.local`
 * wins over `.env` because it is loaded first.
 */
import path from "node:path";
import { config } from "dotenv";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const root = process.cwd();
  config({ path: path.join(root, ".env.local"), quiet: true });
  config({ path: path.join(root, ".env"), quiet: true });
}

/** Trimmed env value, or undefined when unset/blank. */
export function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Names from `names` that are unset or blank. */
export function missingEnv(names: readonly string[]): string[] {
  return names.filter((name) => readEnv(name) === undefined);
}

/** Thrown for problems the user must fix; the CLI prints the message only, never a stack. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/** Positive number from env, else the fallback. Rejects garbage instead of silently using NaN. */
export function readNumberEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new UserError(`${name} must be a positive number (got "${raw}").`);
  }
  return value;
}

/**
 * Exits once stdout/stderr have drained. A bare process.exit() can cut off piped
 * output on POSIX, and open HTTP keep-alive sockets would otherwise keep the
 * process alive after the work is done.
 */
export function flushAndExit(code: number): void {
  process.exitCode = code;
  process.stdout.write("", () => process.stderr.write("", () => process.exit(code)));
}

/** Last-resort handler for a CLI entry point: clear message, no stack for user errors, exit 1. */
export function exitWithError(error: unknown): void {
  if (error instanceof UserError) {
    console.error(`\n✖ ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`\n✖ Unexpected error: ${error.message}`);
    if (process.env.DEBUG) console.error(error.stack);
  } else {
    console.error("\n✖ Unexpected error:", error);
  }
  flushAndExit(1);
}
