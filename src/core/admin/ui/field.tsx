import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

const control =
  "w-full rounded-md border border-(--a-line-strong) bg-(--a-surface) px-3 text-[15px] sm:text-sm text-(--a-ink) shadow-xs placeholder:text-(--a-ink-soft) " +
  "transition-[border-color,box-shadow] duration-100 ease-out " +
  "outline-none focus-visible:border-(--a-primary) focus-visible:ring-2 focus-visible:ring-(--a-ring) " +
  "disabled:cursor-not-allowed disabled:bg-(--a-muted) disabled:text-(--a-ink-soft) " +
  "aria-invalid:border-red-600 aria-invalid:focus-visible:ring-red-600";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-11 sm:pointer-fine:h-9", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, "py-2 leading-relaxed resize-y", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <select ref={ref} className={cn(control, "h-11 sm:pointer-fine:h-9 cursor-pointer appearance-none pr-8")} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-(--a-ink-soft)" />
    </div>
  );
});

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-[13px] font-medium text-(--a-ink)", className)}>
      {children}
    </label>
  );
}

export function CharCount({ value, max, recommended }: { value: string; max?: number; recommended?: number }) {
  const length = value.length;
  const limit = recommended ?? max ?? 0;
  const over = limit > 0 && length > limit;
  return (
    <span aria-live="polite" className={cn("text-xs tabular-nums", over ? "text-(--a-ink)" : "text-(--a-ink-soft)")}>
      {length}
      {limit ? ` / ${limit}` : ""}
      {over && recommended ? " · may be cut off" : ""}
    </span>
  );
}

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** right side of the label row, e.g. a CharCount */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint + error. The control should set id, aria-describedby and aria-invalid via fieldA11y(). */
export function Field({ id, label, hint, error, aside, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-(--a-ink-soft)">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function fieldA11y(id: string, error?: string, hint?: boolean) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}
