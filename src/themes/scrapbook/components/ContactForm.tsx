"use client";

/**
 * Inquiry form wired to `submitInquiry` with `useActionState`. Field errors
 * sit under their inputs; a general error offers Instagram as the way round.
 * Success is the peak-end moment: the letter flips to a stamped "sent" card
 * with a spark burst, and focus moves to it.
 */
import { ArrowRight, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { startTransition, useActionState, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { submitInquiry } from "@/core/actions/inquiries";
import type { ActionResult } from "@/core/actions/result";
import { cn } from "../lib/cn";
import { EASE_IN, EASE_OUT } from "../motion/easing";
import { SparkBurst } from "../motion/SparkBurst";
import { Heart } from "./Doodles";

export function ContactForm({
  instagram,
  name,
  budgetOptions,
}: {
  instagram: string;
  name: string;
  /** from settings.contact.budgetOptions; empty hides the field */
  budgetOptions: string[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitInquiry, null);
  const [dismissed, setDismissed] = useState<ActionResult | null>(null);
  const reduce = useReducedMotion();
  const successRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const sent = state?.ok === true && dismissed !== state;
  const error = state && !state.ok ? state : null;
  const fe = error?.fieldErrors ?? {};

  useEffect(() => {
    if (sent) {
      formRef.current?.reset();
      successRef.current?.focus();
    } else if (error) {
      // Field errors: put the cursor in the first invalid field; otherwise the summary.
      const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      (firstInvalid ?? errorRef.current)?.focus();
    }
  }, [sent, error]);

  return (
    <div className="relative [perspective:1200px]">
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="sent"
            className="relative flex min-h-[32rem] flex-col items-center justify-center overflow-hidden bg-(--card) px-8 py-14 text-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, rotateY: -70 }}
            animate={{ opacity: 1, rotateY: 0, transition: { duration: 0.4, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_IN } }}
          >
            <div className="relative">
              <SparkBurst />
              {/* the stamp lands: a playful squash on a non-text element */}
              <motion.div
                aria-hidden
                className="sb-stamp bg-(--rose-deep) drop-shadow-md"
                initial={reduce ? false : { scale: 1.6, rotate: -18, opacity: 0 }}
                animate={{ scale: [1.6, 0.92, 1], rotate: -6, opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE_OUT, times: [0, 0.7, 1] }}
              >
                <div className="grid size-24 place-items-center border border-dashed border-(--cream)/50">
                  <Heart className="size-10 text-(--cream)" />
                </div>
              </motion.div>
            </div>
            <h3 ref={successRef} tabIndex={-1} className="sb-accent mt-8 text-[2.6rem] leading-none text-(--rose-deep) outline-none">
              Message sent
            </h3>
            <p className="mt-4 max-w-[34ch] text-[1.0625rem] leading-relaxed text-(--ink-soft)">
              Thank you for writing to {name.split(" ")[0]}. You&apos;ll hear back within a day, usually sooner.
            </p>
            <button
              type="button"
              onClick={() => setDismissed(state)}
              className="mt-8 inline-flex min-h-11 items-center font-semibold text-(--rose-deep) underline decoration-(--blush) decoration-2 underline-offset-[6px]"
            >
              Send another message
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            ref={formRef}
            action={action}
            onSubmit={(e) => {
              // Submit through a transition so React does not clear the fields
              // when the server returns an error; the no-JS path still posts.
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              startTransition(() => action(data));
            }}
            className="relative bg-(--card) px-5 py-7 md:px-10 md:py-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_IN } }}
            aria-describedby={error ? "contact-error" : undefined}
          >
            <p className="sb-accent text-[1.9rem] leading-none text-(--rose-deep)">Dear {name.split(" ")[0]},</p>

            <div className="mt-6 grid gap-4 md:mt-7 md:grid-cols-2 md:gap-5">
              <Field id="cf-name" name="name" label="Your name" autoComplete="name" required maxLength={120} error={fe.name} />
              <Field id="cf-email" name="email" type="email" label="Email" autoComplete="email" required maxLength={254} error={fe.email} />
              <Field id="cf-company" name="company" label="Brand or company" autoComplete="organization" maxLength={160} error={fe.company} optional />
              {budgetOptions.length ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="cf-budget" className="text-sm font-semibold">
                  Budget <span className="font-normal text-(--ink-soft)">(optional)</span>
                </label>
                <select
                  id="cf-budget"
                  name="budget"
                  defaultValue=""
                  className="min-h-12 rounded-md border border-(--ink-soft) bg-(--cream) px-3 text-base text-(--ink) transition-colors duration-150 hover:border-(--ink) focus-visible:border-(--ink)"
                >
                  <option value="">Choose a range</option>
                  {budgetOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <label htmlFor="cf-message" className="text-sm font-semibold">
                What do you need?
              </label>
              <textarea
                id="cf-message"
                name="message"
                required
                rows={4}
                maxLength={4000}
                aria-invalid={fe.message ? true : undefined}
                aria-describedby={fe.message ? "cf-message-error" : "cf-message-hint"}
                className={cn(inputClass, "min-h-36 resize-y py-3")}
              />
              {fe.message ? (
                <p id="cf-message-error" className="text-sm font-semibold text-(--rose-deep)">
                  {fe.message[0]}
                </p>
              ) : (
                <p id="cf-message-hint" className="text-sm text-(--ink-soft)">
                  Product, platform, number of videos, timeline. Rough is fine.
                </p>
              )}
            </div>

            {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
            <div aria-hidden className="absolute -left-[9999px] top-auto size-px overflow-hidden">
              <label htmlFor="cf-website">Website</label>
              <input id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            {error ? (
              <div
                id="contact-error"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="mt-6 rounded-md border-l-4 border-(--rose-deep) bg-(--blush)/45 px-4 py-3 text-[0.95rem] outline-none"
              >
                <p className="font-semibold text-(--rose-deeper)">{error.error}</p>
                <p className="mt-1 text-(--ink)">
                  You can also{" "}
                  <a href={instagram} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                    send a DM on Instagram
                  </a>
                  .
                </p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-(--rose-deep) px-7 text-[0.95rem] font-semibold text-(--cream) shadow-[0_10px_24px_-12px_rgb(44_17_25/0.7)] transition-[background-color,transform] duration-150 hover:bg-(--rose-deeper) active:scale-[0.97] disabled:cursor-progress disabled:opacity-80"
              >
                {pending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    Sending
                  </>
                ) : (
                  <>
                    Send message
                    <ArrowRight className="size-4" aria-hidden />
                  </>
                )}
              </button>
              <p className="text-sm text-(--ink-soft)" aria-live="polite">
                {pending ? "Sending your message…" : ""}
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-(--ink-soft) bg-(--cream) px-3 text-base text-(--ink) placeholder:text-(--ink-soft) transition-colors duration-150 hover:border-(--ink) focus-visible:border-(--ink) aria-[invalid=true]:border-2 aria-[invalid=true]:border-(--rose-deep)";

function Field({
  id,
  label,
  error,
  optional,
  ...input
}: {
  id: string;
  label: string;
  error?: string[];
  optional?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label} {optional ? <span className="font-normal text-(--ink-soft)">(optional)</span> : null}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, "min-h-12")}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-(--rose-deep)">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}
