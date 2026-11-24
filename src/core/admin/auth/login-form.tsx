"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CircleAlert, Eye, EyeOff, HeartCrack, LockKeyhole } from "lucide-react";
import { signIn } from "@/core/actions/auth";
import type { ActionResult } from "@/core/actions/result";
import { Button } from "../ui/button";

type LoginState = (ActionResult & { attempt: number }) | null;

export interface LoginConsent {
  label: string;
  error: string;
}

/**
 * Single-password sign-in (ADMIN_PASSWORD), plus an optional creator-specific
 * consent checkbox that must be ticked (also enforced by the server action).
 * Errors shake their field (3 times over ~300ms, skipped with reduced motion)
 * and move focus back to it.
 */
export function LoginForm({ disabled = false, consent = null }: { disabled?: boolean; consent?: LoginConsent | null }) {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(async (prev, formData) => {
    const result = await signIn(prev, formData);
    return { ...result, attempt: (prev?.attempt ?? 0) + 1 };
  }, null);
  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // client-side consent refusals (no round trip); bumping it re-triggers the shake
  const [refusals, setRefusals] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const serverError = state && !state.ok ? state : null;
  const serverConsentError = serverError?.fieldErrors?.consent?.[0] ?? null;
  const consentError = consent && !agreed && (refusals > 0 || serverConsentError) ? consent.error : null;
  const passwordError = serverError && !serverConsentError ? serverError.error : null;

  useEffect(() => {
    if (!passwordError) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [passwordError, state?.attempt]);

  useEffect(() => {
    if (consentError) consentRef.current?.focus();
  }, [consentError, refusals, state?.attempt]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (consent && !agreed) {
      e.preventDefault();
      setRefusals((n) => n + 1);
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-(--a-ink)">
          Password
        </label>
        <div key={state?.attempt ?? 0} className={passwordError ? "adm-shake" : undefined}>
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
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "password-error" : undefined}
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
        {passwordError ? (
          <p id="password-error" role="alert" className="flex items-center gap-1.5 text-sm text-(--a-primary)">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {passwordError}
          </p>
        ) : null}
      </div>

      {consent ? (
        <div className="flex flex-col gap-1.5">
          <div key={`${refusals}-${state?.attempt ?? 0}`} className={consentError ? "adm-shake" : undefined}>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm leading-snug transition-colors duration-150 ${
                agreed
                  ? "border-(--a-primary) bg-(--a-blush)/40 text-(--a-ink)"
                  : consentError
                    ? "border-(--a-primary) bg-(--a-surface) text-(--a-ink)"
                    : "border-(--a-line-strong) bg-(--a-surface) text-(--a-ink) hover:border-(--a-primary)"
              }`}
            >
              {/* real checkbox (keyboard + screen readers), drawn as a heart-red tick box */}
              <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
                <input
                  ref={consentRef}
                  type="checkbox"
                  name="consent"
                  value="yes"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={disabled}
                  aria-invalid={consentError ? true : undefined}
                  aria-describedby={consentError ? "consent-error" : undefined}
                  className="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-(--a-primary) bg-(--a-muted) transition-colors duration-150 checked:bg-(--a-primary) focus-visible:ring-2 focus-visible:ring-(--a-primary) focus-visible:ring-offset-2 focus-visible:outline-none"
                />
                <Check aria-hidden className="pointer-events-none absolute size-3.5 text-(--a-primary-ink) opacity-0 transition-opacity duration-100 peer-checked:opacity-100" strokeWidth={3} />
              </span>
              <span>{consent.label}</span>
            </label>
          </div>
          {consentError ? (
            <p id="consent-error" role="alert" className="flex items-center gap-1.5 text-sm font-medium text-(--a-primary)">
              <HeartCrack className="size-4 shrink-0" aria-hidden />
              {consentError}
            </p>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" variant="primary" pending={pending} disabled={disabled} className="h-12 w-full justify-center rounded-full text-base">
        {pending ? "Checking…" : "Enter the studio"}
      </Button>
    </form>
  );
}
