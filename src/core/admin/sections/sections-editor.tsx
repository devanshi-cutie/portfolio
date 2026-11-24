"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Tabs } from "radix-ui";
import { ChevronDown } from "lucide-react";
import type { SectionKey, SiteSettings, StatSource } from "@/core/types/content";
import { SECTION_KEYS } from "@/core/types/content";
import { cn } from "../lib/cn";
import { useSettingsForm } from "../lib/use-settings-form";
import { Button, focusRing } from "../ui/button";
import { Field, Input, Select, Textarea, fieldA11y } from "../ui/field";
import { PageHeader } from "../ui/misc";
import { SaveBar } from "../ui/save-bar";
import { DragHandle, SortableContainer, SortableItem } from "../ui/sortable";
import { SortableFieldList } from "../ui/sortable-field-list";
import { Switch } from "../ui/switch";
import { TagInput } from "../ui/tag-input";

const FORM_ID = "sections-form";

export const SECTION_LABELS: Record<SectionKey, { name: string; about: string }> = {
  hero: { name: "Hero", about: "Top of the page: your name, tagline and portrait." },
  about: { name: "About", about: "Your bio." },
  stats: { name: "Numbers", about: "Uses the list in the Numbers tab." },
  highlights: { name: "Why work with me", about: "Uses the list in the Highlights tab." },
  work: { name: "Work", about: "Your collections and featured reels." },
  brands: { name: "Brands", about: "Logos and names from Brands." },
  bts: { name: "Behind the scenes", about: "Media marked as BTS." },
  services: { name: "Services", about: "Uses the list in the Services tab." },
  process: { name: "Process", about: "Uses the list in the Process tab." },
  testimonials: { name: "Testimonials", about: "Published testimonials." },
  contact: { name: "Contact", about: "Contact form and details from Profile." },
};

/** Append any section keys the stored settings don't have yet (disabled), so new theme sections show up. */
function withAllSections(settings: SiteSettings): SiteSettings {
  const present = new Set(settings.sections.map((s) => s.key));
  const missing = SECTION_KEYS.filter((k) => !present.has(k)).map((key) => ({ key, enabled: false, eyebrow: "", title: "", subtitle: "" }));
  return missing.length ? { ...settings, sections: [...settings.sections, ...missing] } : settings;
}

function hasErrors(errors: FieldErrors<SiteSettings>, key: keyof SiteSettings) {
  return Boolean(errors[key]);
}

export function SectionsEditor({ settings }: { settings: SiteSettings }) {
  const initial = useMemo(() => withAllSections(settings), [settings]);
  const { form, onSubmit, discard } = useSettingsForm(initial);
  const {
    control,
    register,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const tabs: { value: string; label: string; errorKey: keyof SiteSettings }[] = [
    { value: "sections", label: "Sections", errorKey: "sections" },
    { value: "stats", label: "Numbers", errorKey: "stats" },
    { value: "highlights", label: "Highlights", errorKey: "highlights" },
    { value: "services", label: "Services", errorKey: "services" },
    { value: "process", label: "Process", errorKey: "process" },
    { value: "brandGroups", label: "Brand groups", errorKey: "brandGroups" },
  ];

  return (
    <>
      <PageHeader title="Page sections" description="Choose which sections your home page shows, in what order, and what they say." />
      <form id={FORM_ID} onSubmit={onSubmit} noValidate>
        <Tabs.Root defaultValue="sections">
          <Tabs.List aria-label="Section settings" className="mb-4 flex gap-1 overflow-x-auto border-b border-(--a-line)">
            {tabs.map((t) => (
              <Tabs.Trigger
                key={t.value}
                value={t.value}
                className={cn(
                  "relative -mb-px flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-(--a-ink-soft) transition-colors duration-100 hover:text-(--a-ink) sm:pointer-fine:h-10",
                  "data-[state=active]:border-(--a-primary) data-[state=active]:font-medium data-[state=active]:text-(--a-ink)",
                  focusRing,
                )}
              >
                {t.label}
                {hasErrors(errors, t.errorKey) ? (
                  <span className="size-1.5 rounded-full bg-red-600" aria-label="has errors" role="img" />
                ) : null}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="sections" forceMount className="data-[state=inactive]:hidden">
            <SectionList control={control} register={register} errors={errors} />
          </Tabs.Content>
          <Tabs.Content value="stats" forceMount className="data-[state=inactive]:hidden">
            <StatsList control={control} register={register} errors={errors} />
          </Tabs.Content>
          <Tabs.Content value="highlights" forceMount className="data-[state=inactive]:hidden">
            <HighlightsList control={control} register={register} errors={errors} />
          </Tabs.Content>
          <Tabs.Content value="services" forceMount className="data-[state=inactive]:hidden">
            <ServicesList control={control} register={register} errors={errors} />
          </Tabs.Content>
          <Tabs.Content value="process" forceMount className="data-[state=inactive]:hidden">
            <ProcessList control={control} register={register} errors={errors} />
          </Tabs.Content>
          <Tabs.Content value="brandGroups" forceMount className="data-[state=inactive]:hidden">
            <BrandGroupsList control={control} register={register} errors={errors} />
          </Tabs.Content>
        </Tabs.Root>
      </form>
      <SaveBar formId={FORM_ID} dirty={isDirty} saving={isSubmitting} onDiscard={discard} />
    </>
  );
}

interface ListProps {
  control: Control<SiteSettings>;
  register: UseFormRegister<SiteSettings>;
  errors: FieldErrors<SiteSettings>;
}

function errorAt(errors: FieldErrors<SiteSettings>, path: (string | number)[]): string | undefined {
  let node: unknown = errors;
  for (const part of path) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[part];
  }
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}

/* -------------------------------------------------------------- sections */

function SectionList({ control, register, errors }: ListProps) {
  const { fields, move } = useFieldArray({ control, name: "sections", keyName: "_id" });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const sections = useWatch({ control, name: "sections" });

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <p className="mb-3 text-sm text-(--a-ink-soft)">Drag to reorder. Switch a section off to hide it without losing its text.</p>
      <SortableContainer
        ids={fields.map((f) => f._id)}
        onMove={move}
        getLabel={(id) => {
          const f = fields.find((x) => x._id === id);
          return f ? `${SECTION_LABELS[f.key]?.name ?? f.key} section` : "section";
        }}
      >
        <ol className="flex flex-col gap-2">
          {fields.map((field, index) => {
            const meta = SECTION_LABELS[field.key] ?? { name: field.key, about: "" };
            const current = sections?.[index];
            const isOpen = expanded.has(field.key);
            const panelId = `section-${field.key}-fields`;
            const hasError = Boolean(errorAt(errors, ["sections", index, "title"]) || errorAt(errors, ["sections", index, "eyebrow"]) || errorAt(errors, ["sections", index, "subtitle"]));
            return (
              <SortableItem key={field._id} id={field._id} className={cn("rounded-lg border bg-(--a-surface)", hasError ? "border-red-300" : "border-(--a-line)")}>
                {() => (
                  <div>
                    <div className="flex items-center gap-1.5 p-2 sm:gap-2">
                      <DragHandle label={`${meta.name} section`} />
                      <span className="w-6 text-center text-xs tabular-nums text-(--a-ink-soft)" aria-hidden>
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggle(field.key)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className={cn("flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 text-left sm:pointer-fine:min-h-9", focusRing)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-medium", current?.enabled ? "text-(--a-ink)" : "text-(--a-ink-soft)")}>
                            {meta.name}
                            {!current?.enabled ? <span className="ml-2 text-xs font-normal text-(--a-ink-soft)">Hidden</span> : null}
                          </span>
                          <span className="block truncate text-xs text-(--a-ink-soft)">{current?.title || meta.about}</span>
                        </span>
                        <ChevronDown
                          aria-hidden
                          className={cn("size-4 shrink-0 text-(--a-ink-soft) transition-transform duration-150", isOpen && "rotate-180")}
                        />
                      </button>
                      <Controller
                        control={control}
                        name={`sections.${index}.enabled`}
                        render={({ field: f }) => (
                          <Switch label={`Show ${meta.name} section`} checked={!!f.value} onCheckedChange={f.onChange} className="px-2" />
                        )}
                      />
                    </div>
                    <div id={panelId} hidden={!isOpen} className="border-t border-(--a-line) px-3 py-3 sm:pl-[5.25rem]">
                      <p className="mb-3 text-xs text-(--a-ink-soft)">{meta.about}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field id={`s-${field.key}-eyebrow`} label="Small label" hint="Above the heading" error={errorAt(errors, ["sections", index, "eyebrow"])}>
                          <Input {...fieldA11y(`s-${field.key}-eyebrow`, errorAt(errors, ["sections", index, "eyebrow"]), true)} {...register(`sections.${index}.eyebrow`)} />
                        </Field>
                        <Field id={`s-${field.key}-title`} label="Heading" error={errorAt(errors, ["sections", index, "title"])}>
                          <Input {...fieldA11y(`s-${field.key}-title`, errorAt(errors, ["sections", index, "title"]))} {...register(`sections.${index}.title`)} />
                        </Field>
                        <Field id={`s-${field.key}-subtitle`} label="Intro line" className="sm:col-span-2" error={errorAt(errors, ["sections", index, "subtitle"])}>
                          <Textarea rows={2} {...fieldA11y(`s-${field.key}-subtitle`, errorAt(errors, ["sections", index, "subtitle"]))} {...register(`sections.${index}.subtitle`)} />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}
              </SortableItem>
            );
          })}
        </ol>
      </SortableContainer>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set(fields.map((f) => f.key)))}>
          Expand all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set())}>
          Collapse all
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- lists */

/** Where a number's value comes from. instagram.* are stored and updated from the Instagram page; site.* are counted live. */
const STAT_SOURCE_OPTIONS: { value: StatSource; label: string }[] = [
  { value: "manual", label: "Typed by hand" },
  { value: "instagram.followers", label: "Instagram followers" },
  { value: "instagram.posts", label: "Instagram posts" },
  { value: "instagram.reelViews", label: "Instagram reel views (all reels)" },
  { value: "instagram.topReelViews", label: "Instagram top reel views" },
  { value: "site.brands", label: "Brands on this site (auto)" },
  { value: "site.reels", label: "Reels on this site (auto)" },
];

function StatSourceHint({ source }: { source: StatSource | undefined }) {
  if (source?.startsWith("instagram.")) {
    return (
      <>
        Updated from the{" "}
        <Link href="/admin/instagram" className={cn("rounded font-medium text-(--a-ink) underline underline-offset-2", focusRing)}>
          Instagram page
        </Link>
        .
      </>
    );
  }
  if (source === "site.brands") return <>Counted from your published brands. The value above shows if there are none.</>;
  if (source === "site.reels") return <>Counted from your published reels. The value above shows if there are none.</>;
  return null;
}

function StatsList({ control, register, errors }: ListProps) {
  const { fields, move, remove, append } = useFieldArray({ control, name: "stats" });
  return (
    <SortableFieldList
      ids={fields.map((f) => f.id)}
      onMove={move}
      onRemove={remove}
      onAdd={() => append({ value: "", label: "" })}
      itemName="number"
      getLabel={(i) => `number ${i + 1}`}
      emptyText="No numbers yet. Add things like “25+ brands”."
      renderItem={(i) => <StatRow index={i} control={control} register={register} errors={errors} />}
    />
  );
}

/** One number. Watches only its own source, so typing in one row doesn't re-render the others. */
function StatRow({ index: i, control, register, errors }: ListProps & { index: number }) {
  const source = useWatch({ control, name: `stats.${i}.source` });
  const auto = source?.startsWith("site.") ?? false;
  const hint = source && source !== "manual" ? <StatSourceHint source={source} /> : undefined;
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
      <Field id={`stat-${i}-value`} label={auto ? "Fallback value" : "Value"} error={errorAt(errors, ["stats", i, "value"])}>
        <Input {...fieldA11y(`stat-${i}-value`, errorAt(errors, ["stats", i, "value"]))} placeholder="e.g. 25+" {...register(`stats.${i}.value`)} />
      </Field>
      <Field id={`stat-${i}-label`} label="Label" error={errorAt(errors, ["stats", i, "label"])}>
        <Input {...fieldA11y(`stat-${i}-label`, errorAt(errors, ["stats", i, "label"]))} placeholder="Brands collaborated with" {...register(`stats.${i}.label`)} />
      </Field>
      <Field id={`stat-${i}-source`} label="Source" hint={hint} error={errorAt(errors, ["stats", i, "source"])} className="sm:col-span-2">
        <Select
          {...fieldA11y(`stat-${i}-source`, errorAt(errors, ["stats", i, "source"]), Boolean(hint))}
          {...register(`stats.${i}.source`)}
        >
          {STAT_SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function HighlightsList({ control, register, errors }: ListProps) {
  const { fields, move, remove, append } = useFieldArray({ control, name: "highlights" });
  return (
    <SortableFieldList
      ids={fields.map((f) => f.id)}
      onMove={move}
      onRemove={remove}
      onAdd={() => append({ title: "", body: "" })}
      itemName="highlight"
      getLabel={(i) => `highlight ${i + 1}`}
      renderItem={(i) => <TitleBody prefix="highlights" index={i} register={register} errors={errors} />}
    />
  );
}

function ProcessList({ control, register, errors }: ListProps) {
  const { fields, move, remove, append } = useFieldArray({ control, name: "process" });
  return (
    <SortableFieldList
      ids={fields.map((f) => f.id)}
      onMove={move}
      onRemove={remove}
      onAdd={() => append({ title: "", body: "" })}
      itemName="step"
      getLabel={(i) => `step ${i + 1}`}
      renderItem={(i) => <TitleBody prefix="process" index={i} register={register} errors={errors} />}
    />
  );
}

function TitleBody({
  prefix,
  index,
  register,
  errors,
}: {
  prefix: "highlights" | "process";
  index: number;
  register: UseFormRegister<SiteSettings>;
  errors: FieldErrors<SiteSettings>;
}) {
  const titleId = `${prefix}-${index}-title`;
  const bodyId = `${prefix}-${index}-body`;
  const titleError = errorAt(errors, [prefix, index, "title"]);
  const bodyError = errorAt(errors, [prefix, index, "body"]);
  return (
    <div className="grid gap-2">
      <Field id={titleId} label="Title" error={titleError}>
        <Input {...fieldA11y(titleId, titleError)} {...register(`${prefix}.${index}.title`)} />
      </Field>
      <Field id={bodyId} label="Text" error={bodyError}>
        <Textarea rows={2} {...fieldA11y(bodyId, bodyError)} {...register(`${prefix}.${index}.body`)} />
      </Field>
    </div>
  );
}

function ServicesList({ control, register, errors }: ListProps) {
  const { fields, move, remove, append } = useFieldArray({ control, name: "services" });
  return (
    <SortableFieldList
      ids={fields.map((f) => f.id)}
      onMove={move}
      onRemove={remove}
      onAdd={() => append({ title: "", description: "", deliverables: [] })}
      itemName="service"
      getLabel={(i) => `service ${i + 1}`}
      renderItem={(i) => (
        <div className="grid gap-2">
          <Field id={`svc-${i}-title`} label="Service" error={errorAt(errors, ["services", i, "title"])}>
            <Input {...fieldA11y(`svc-${i}-title`, errorAt(errors, ["services", i, "title"]))} {...register(`services.${i}.title`)} />
          </Field>
          <Field id={`svc-${i}-description`} label="Description" error={errorAt(errors, ["services", i, "description"])}>
            <Textarea rows={2} {...fieldA11y(`svc-${i}-description`, errorAt(errors, ["services", i, "description"]))} {...register(`services.${i}.description`)} />
          </Field>
          <Field id={`svc-${i}-deliverables`} label="What's included" hint="Press Enter after each item." error={errorAt(errors, ["services", i, "deliverables"])}>
            <Controller
              control={control}
              name={`services.${i}.deliverables`}
              render={({ field }) => (
                <TagInput id={`svc-${i}-deliverables`} value={field.value ?? []} onChange={field.onChange} describedBy={`svc-${i}-deliverables-hint`} placeholder="e.g. Vertical 9:16 edit" />
              )}
            />
          </Field>
        </div>
      )}
    />
  );
}

function BrandGroupsList({ control, register, errors }: ListProps) {
  const { fields, move, remove, append } = useFieldArray({ control, name: "brandGroups" });
  return (
    <div>
      <p className="mb-3 text-sm text-(--a-ink-soft)">
        The Brands section lists brands under these headings, in this order. A brand appears under every group whose tag it has
        (set tags on the Brands page).
      </p>
      <SortableFieldList
        ids={fields.map((f) => f.id)}
        onMove={move}
        onRemove={remove}
        onAdd={() => append({ tag: "", label: "" })}
        itemName="group"
        getLabel={(i) => `group ${i + 1}`}
        emptyText="No groups yet. Without groups, brands are shown as one list."
        renderItem={(i) => {
          const tagError = errorAt(errors, ["brandGroups", i, "tag"]);
          const labelError = errorAt(errors, ["brandGroups", i, "label"]);
          return (
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <Field id={`bg-${i}-tag`} label="Tag" hint="Lowercase, e.g. ugc" error={tagError}>
                <Input
                  {...fieldA11y(`bg-${i}-tag`, tagError, true)}
                  spellCheck={false}
                  autoCapitalize="none"
                  {...register(`brandGroups.${i}.tag`, { setValueAs: (v: string) => (typeof v === "string" ? v.trim().toLowerCase() : v) })}
                />
              </Field>
              <Field id={`bg-${i}-label`} label="Heading" error={labelError}>
                <Input {...fieldA11y(`bg-${i}-label`, labelError)} placeholder="e.g. Content made for brands" {...register(`brandGroups.${i}.label`)} />
              </Field>
            </div>
          );
        }}
      />
    </div>
  );
}
