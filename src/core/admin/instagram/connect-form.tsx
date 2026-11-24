"use client";

import { useId, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { connectInstagram } from "@/core/actions/instagram";
import { useAction } from "../lib/use-action";
import { Button } from "../ui/button";
import { Field, Input, fieldA11y } from "../ui/field";

/** Password-type token field + Connect. The token is sent once to the server action and never shown again. */
export function ConnectForm({ submitLabel = "Connect", disabled }: { submitLabel?: string; disabled?: boolean }) {
  const id = useId();
  const inputId = `${id}-token`;
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { run, isBusy } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = token.trim();
    if (!value) {
      setError("Paste the token first");
      return;
    }
    setError(undefined);
    const result = await run(() => connectInstagram(value), { key: "connect", success: "Instagram connected" });
    if (result.ok) {
      setToken("");
    } else {
      setError(result.fieldErrors?._form?.[0] ?? result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field
        id={inputId}
        label="Instagram access token"
        hint="Stored on the server only. It's never shown again or sent to visitors."
        error={error}
        className="min-w-0 flex-1"
      >
        <Input
          {...fieldA11y(inputId, error, true)}
          type="password"
          // keep password managers from offering the admin password or saving the token
          autoComplete="new-password"
          data-1p-ignore=""
          data-lpignore="true"
          spellCheck={false}
          placeholder="IGAA…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={disabled}
        />
      </Field>
      <Button type="submit" variant="primary" pending={isBusy("connect")} disabled={disabled} className="sm:mb-[1.375rem]">
        <KeyRound aria-hidden />
        {submitLabel}
      </Button>
    </form>
  );
}
