"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { signIn } from "@/core/actions/auth";
import type { ActionResult } from "@/core/actions/result";
import { Button } from "../ui/button";

type LoginState = (ActionResult & { attempt: number }) | null;

/**
 * Single-password sign-in (ADMIN_PASSWORD). On a wrong password the field
 * shakes (3 times over ~300ms, skipped with reduced motion) and focus returns
 * to the input with its text selected, so a retry is one keystroke away.
 */
export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(async (prev, formData) => {
    const result = await signIn(prev, formData);
    return { ...result, attempt: (prev?.attempt ?? 0) + 1 };
  }, null);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const error = state && !state.ok ? state.error : null;

  useEffect(() => {
    if (!error) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [error, state?.attempt]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-(--a-ink)">
          Password
        </label>
        <div key={state?.attempt ?? 0} className={error ? "adm-shake" : undefined}>
          <div className="relative">
            <LockKeyhole aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--a-ink-soft)" />
            <input
              ref={inputRef}
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              required
              spellCheck={false}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "password-error" : undefined}
              className="h-12 w-full rounded-full border border-(--a-line-strong) bg-(--a-muted) pr-12 pl-10 text-base text-(--a-ink) transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-(--a-ink-soft) focus-visible:border-(--a-primary) focus-visible:ring-2 focus-visible:ring-(--a-primary) disabled:opacity-60 aria-invalid:border-(--a-primary)"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              disabled={disabled}
              aria-label="Show password"
              aria-pressed={visible}
              className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full text-(--a-ink-soft) transition-colors duration-150 hover:bg-(--a-surface) hover:text-(--a-ink) focus-visible:ring-2 focus-visible:ring-(--a-primary) focus-visible:outline-none disabled:opacity-50"
            >
              {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
        {error ? (
          <p id="password-error" role="alert" className="flex items-center gap-1.5 text-sm text-(--a-primary)">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="primary" pending={pending} disabled={disabled} className="h-12 w-full justify-center rounded-full text-base">
        {pending ? "Checking…" : "Enter the studio"}
      </Button>
    </form>
  );
}
