import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Minimal structural view of a zod schema, so this file does not depend on schema internals. */
interface SafeParseSchema<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> } };
}

/**
 * Validates `values` with a shared zod schema and pushes issues into react-hook-form.
 * Returns the parsed data, or null when invalid.
 */
export function validateWith<TForm extends FieldValues, TOut>(
  schema: SafeParseSchema<TOut>,
  values: unknown,
  setError: UseFormSetError<TForm>,
  pathPrefix = "",
): TOut | null {
  const parsed = schema.safeParse(values);
  if (parsed.success) return parsed.data;
  let focused = false;
  for (const issue of parsed.error.issues) {
    const path = [pathPrefix, ...issue.path.map(String)].filter(Boolean).join(".");
    setError((path || "root") as Path<TForm>, { type: "validate", message: issue.message }, { shouldFocus: !focused });
    focused = true;
  }
  return null;
}

/** Server-side fieldErrors from an ActionResult -> react-hook-form errors. */
export function applyFieldErrors<TForm extends FieldValues>(
  fieldErrors: Record<string, string[]> | undefined,
  setError: UseFormSetError<TForm>,
  pathPrefix = "",
) {
  if (!fieldErrors) return;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const path = [pathPrefix, key].filter(Boolean).join(".");
    setError(path as Path<TForm>, { type: "server", message: messages[0] ?? "Invalid value" });
  }
}
