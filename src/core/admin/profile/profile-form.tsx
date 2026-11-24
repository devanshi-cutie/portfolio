"use client";

import { Controller, useFieldArray, useWatch, type FieldErrors } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import type { MediaItem, SiteSettings } from "@/core/types/content";
import { useSettingsForm } from "../lib/use-settings-form";
import { Button } from "../ui/button";
import { CharCount, Field, Input, Select, Textarea, fieldA11y } from "../ui/field";
import { PageHeader, Panel } from "../ui/misc";
import { SaveBar } from "../ui/save-bar";
import { DragHandle, SortableContainer, SortableItem } from "../ui/sortable";
import { TagInput } from "../ui/tag-input";
import { MediaPickerField } from "../media/media-picker";

const FORM_ID = "profile-form";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X (Twitter)" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];

function err(errors: FieldErrors<SiteSettings>, path: string): string | undefined {
  let node: unknown = errors;
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}

export function ProfileForm({ settings, media }: { settings: SiteSettings; media: MediaItem[] }) {
  const { form, onSubmit, discard } = useSettingsForm(settings);
  const {
    register,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form;
  const socials = useFieldArray({ control, name: "socials" });
  const [seoTitle, seoDescription, shortBio] = useWatch({ control, name: ["seo.title", "seo.description", "identity.shortBio"] });

  /** text input bound to a settings path */
  const text = (path: Parameters<typeof register>[0], label: string, opts: { hint?: string; placeholder?: string; type?: string; autoComplete?: string } = {}) => {
    const id = `f-${path.replace(/\./g, "-")}`;
    const error = err(errors, path);
    return (
      <Field id={id} label={label} hint={opts.hint} error={error}>
        <Input
          {...fieldA11y(id, error, !!opts.hint)}
          type={opts.type ?? "text"}
          placeholder={opts.placeholder}
          autoComplete={opts.autoComplete ?? "off"}
          {...register(path)}
        />
      </Field>
    );
  };

  return (
    <>
      <PageHeader title="Profile & SEO" description="Who you are, how brands reach you, and how your site looks in Google and link previews." />
      <form id={FORM_ID} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Panel title="Identity" description="Shown in the hero and about sections.">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("identity.name", "Name", { autoComplete: "name" })}
            {text("identity.handle", "Instagram handle", { hint: "Without the @", placeholder: "e.g. yourhandle" })}
            {text("identity.role", "Role", { placeholder: "e.g. Content creator" })}
            {text("identity.location", "Location", { placeholder: "e.g. City, Country" })}
            <div className="sm:col-span-2">{text("identity.tagline", "Tagline", { hint: "One line under your name." })}</div>
            <Field
              id="f-shortBio"
              label="Short bio"
              className="sm:col-span-2"
              hint="Two or three sentences for the hero/about intro."
              aside={<CharCount value={shortBio ?? ""} recommended={280} />}
              error={err(errors, "identity.shortBio")}
            >
              <Textarea {...fieldA11y("f-shortBio", err(errors, "identity.shortBio"), true)} rows={3} {...register("identity.shortBio")} />
            </Field>
            <Field id="f-longBio" label="Long bio" className="sm:col-span-2" error={err(errors, "identity.longBio")}>
              <Textarea {...fieldA11y("f-longBio", err(errors, "identity.longBio"))} rows={6} {...register("identity.longBio")} />
            </Field>
            <Field
              id="f-keywords"
              label="Rotating keywords"
              className="sm:col-span-2"
              hint="Words that cycle in the hero, e.g. Fashion, Jewellery, Travel."
              error={err(errors, "identity.keywords")}
            >
              <Controller
                control={control}
                name="identity.keywords"
                render={({ field }) => (
                  <TagInput id="f-keywords" value={field.value ?? []} onChange={field.onChange} describedBy="f-keywords-hint" placeholder="Add a keyword" />
                )}
              />
            </Field>
            <Controller
              control={control}
              name="identity.portraitMediaId"
              render={({ field }) => (
                <MediaPickerField
                  id="f-portrait"
                  label="Portrait"
                  hint="A photo of you for the hero and about sections."
                  media={media}
                  value={field.value}
                  onChange={field.onChange}
                  preferKind="portrait"
                />
              )}
            />
            <Controller
              control={control}
              name="identity.heroMediaId"
              render={({ field }) => (
                <MediaPickerField
                  id="f-hero"
                  label="Hero media"
                  hint="Optional background video or image at the top of the page."
                  media={media}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </Panel>

        <Panel title="Contact" description="Where the contact section and buttons send people.">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("contact.email", "Email", { type: "email", autoComplete: "email" })}
            {text("contact.phone", "Phone", { type: "tel", autoComplete: "tel" })}
            {text("contact.whatsapp", "WhatsApp number", { hint: "Digits with country code, e.g. 919876543210", type: "tel" })}
            {text("contact.ctaLabel", "Button text", { placeholder: "e.g. Work with me" })}
            {text("contact.availability", "Availability note", { placeholder: "Open for collaborations" })}
            {text("contact.mediaKitUrl", "Media kit link", { type: "url", placeholder: "https://" })}
            <Field
              id="f-budgets"
              label="Budget options on the contact form"
              className="sm:col-span-2"
              hint="Choices visitors can pick from, e.g. Under 10k. Leave empty to hide the field."
              error={err(errors, "contact.budgetOptions")}
            >
              <Controller
                control={control}
                name="contact.budgetOptions"
                render={({ field }) => (
                  <TagInput id="f-budgets" value={field.value ?? []} onChange={field.onChange} describedBy="f-budgets-hint" placeholder="Add an option" />
                )}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Social links"
          description="Drag to reorder."
          actions={
            <Button size="sm" onClick={() => socials.append({ platform: "instagram", label: "", url: "" })}>
              <Plus aria-hidden /> Add link
            </Button>
          }
        >
          {socials.fields.length === 0 ? (
            <p className="py-4 text-center text-sm text-(--a-ink-soft)">No social links yet.</p>
          ) : (
            <SortableContainer
              ids={socials.fields.map((f) => f.id)}
              onMove={socials.move}
              getLabel={(id) => {
                const i = socials.fields.findIndex((f) => f.id === id);
                return form.getValues(`socials.${i}.label`) || `link ${i + 1}`;
              }}
            >
              <ul className="flex flex-col gap-2">
                {socials.fields.map((field, index) => (
                  <SortableItem key={field.id} id={field.id} className="rounded-lg border border-(--a-line) bg-(--a-surface)">
                    {() => (
                      <div className="flex items-start gap-2 p-2">
                        <DragHandle label={`link ${index + 1}`} className="mt-0.5" />
                        <div className="grid flex-1 gap-2 sm:grid-cols-[10rem_1fr_2fr]">
                          <Select aria-label={`Platform for link ${index + 1}`} {...register(`socials.${index}.platform`)}>
                            {PLATFORMS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </Select>
                          <Input aria-label={`Label for link ${index + 1}`} placeholder="Label" {...register(`socials.${index}.label`)} />
                          <div>
                            <Input
                              aria-label={`URL for link ${index + 1}`}
                              type="url"
                              placeholder="https://"
                              aria-invalid={err(errors, `socials.${index}.url`) ? true : undefined}
                              {...register(`socials.${index}.url`)}
                            />
                            {err(errors, `socials.${index}.url`) ? (
                              <p role="alert" className="mt-1 text-xs text-red-700">
                                {err(errors, `socials.${index}.url`)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove link ${index + 1}`} onClick={() => socials.remove(index)} className="mt-0.5">
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </ul>
            </SortableContainer>
          )}
        </Panel>

        <Panel title="Search & sharing" description="How your site appears in Google results and when the link is shared.">
          <div className="grid gap-4">
            <Field
              id="f-seo-title"
              label="Page title"
              aside={<CharCount value={seoTitle ?? ""} recommended={60} />}
              hint="Around 50–60 characters reads fully in search results."
              error={err(errors, "seo.title")}
            >
              <Input {...fieldA11y("f-seo-title", err(errors, "seo.title"), true)} {...register("seo.title")} />
            </Field>
            <Field
              id="f-seo-description"
              label="Description"
              aside={<CharCount value={seoDescription ?? ""} recommended={160} />}
              hint="Around 150–160 characters."
              error={err(errors, "seo.description")}
            >
              <Textarea {...fieldA11y("f-seo-description", err(errors, "seo.description"), true)} rows={3} {...register("seo.description")} />
            </Field>
            <Controller
              control={control}
              name="seo.ogImageMediaId"
              render={({ field }) => (
                <MediaPickerField
                  id="f-og"
                  label="Share image"
                  hint="Shown when your link is shared on WhatsApp, Instagram DMs, LinkedIn. A landscape photo works best."
                  media={media}
                  value={field.value}
                  onChange={field.onChange}
                  imagesOnly
                />
              )}
            />
          </div>
        </Panel>
      </form>
      <SaveBar formId={FORM_ID} dirty={isDirty} saving={isSubmitting} onDiscard={discard} />
    </>
  );
}
