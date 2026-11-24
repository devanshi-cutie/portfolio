"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

interface TagInputProps {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** suggestions shown as quick-add chips when not already present */
  suggestions?: readonly string[];
  /** normalise each entry, e.g. lowercase tags */
  normalize?: (value: string) => string;
  describedBy?: string;
  invalid?: boolean;
}

/** Editable list of short strings. Enter or comma adds; Backspace on an empty input removes the last one. */
export function TagInput({ id, value, onChange, placeholder = "Type and press Enter", suggestions, normalize, describedBy, invalid }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => (normalize ? normalize(p.trim()) : p.trim()))
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const missing = suggestions?.filter((s) => !value.includes(s)) ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-(--a-surface) px-2 py-1.5 shadow-xs sm:pointer-fine:min-h-9",
          "focus-within:border-(--a-primary) focus-within:ring-2 focus-within:ring-(--a-ring)",
          invalid ? "border-red-500" : "border-(--a-line-strong)",
        )}
      >
        <ul className="contents" aria-label="Current entries">
          {value.map((item) => (
            <li key={item} className="inline-flex h-7 items-center gap-0.5 rounded bg-(--a-muted) pl-2 text-[13px] text-(--a-ink)">
              {item}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== item))}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded text-(--a-ink-soft) hover:bg-(--a-muted-strong) hover:text-(--a-ink) focus-visible:outline-2 focus-visible:outline-(--a-ring)"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="h-8 min-w-28 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-(--a-ink-soft) sm:text-sm"
        />
      </div>
      {missing.length ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-(--a-ink-soft)">
          Add:
          {missing.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange([...value, s])}
              className="inline-flex h-7 cursor-pointer items-center rounded border border-dashed border-(--a-line-strong) px-2 text-(--a-ink-soft) hover:border-(--a-line-strong) hover:bg-(--a-muted) focus-visible:outline-2 focus-visible:outline-(--a-ring)"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
