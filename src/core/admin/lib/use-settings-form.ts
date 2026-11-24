"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/core/types/content";
import { siteSettingsSchema } from "@/core/schemas";
import { updateSettings } from "@/core/actions/settings";
import { callAction } from "./use-action";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { applyFieldErrors, validateWith } from "./validate";

/**
 * A react-hook-form over the whole SiteSettings document. Each screen renders only
 * the fields it owns; the rest pass through unchanged. Saves with updateSettings().
 */
export function useSettingsForm(settings: SiteSettings, prepare?: (values: SiteSettings) => SiteSettings) {
  const router = useRouter();
  const form = useForm<SiteSettings>({ defaultValues: settings });
  useUnsavedChanges(form.formState.isDirty);

  const onSubmit = form.handleSubmit(async (values) => {
    const candidate = prepare ? prepare(values) : values;
    const parsed = validateWith(siteSettingsSchema, candidate, form.setError);
    if (!parsed) return;
    const result = await callAction(() => updateSettings(parsed as SiteSettings), { success: "Saved. Your site is updated." });
    if (result.ok) {
      form.reset(result.data);
      router.refresh();
    } else {
      applyFieldErrors(result.fieldErrors, form.setError);
    }
  });

  return { form, onSubmit, discard: () => form.reset() };
}
