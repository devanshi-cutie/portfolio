"use client";

import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";

interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  /** the form's id, so the submit button can live outside the <form> */
  formId: string;
  disabled?: boolean;
}

/** Sticky footer for long forms: always shows save state; Save/Discard enable once something changes. */
export function SaveBar({ dirty, saving, onDiscard, formId, disabled }: SaveBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-sm transition-colors duration-150 lg:left-60",
        dirty ? "border-(--a-line-strong) bg-(--a-surface)/95 shadow-[0_-4px_16px_-8px_color-mix(in_oklab,var(--a-ink)_18%,transparent)]" : "border-(--a-line) bg-(--a-muted)/90",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <p aria-live="polite" className="mr-auto flex items-center gap-1.5 text-sm text-(--a-ink-soft)">
          {dirty ? (
            <>
              <span aria-hidden className="size-2 rounded-full bg-(--a-accent)" />
              Unsaved changes
            </>
          ) : (
            <>
              <Check className="size-4 text-(--a-primary)" aria-hidden />
              All changes saved
            </>
          )}
        </p>
        <Button variant="ghost" disabled={!dirty || saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button type="submit" form={formId} variant="primary" pending={saving} disabled={!dirty || disabled}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
