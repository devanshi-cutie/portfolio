"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Pencil, Plus, Quote, Trash2 } from "lucide-react";
import type { Brand, MediaItem, Testimonial } from "@/core/types/content";
import type { TestimonialInput } from "@/core/types/admin";
import { testimonialInputSchema } from "@/core/schemas";
import { createTestimonial, deleteTestimonial, reorderTestimonials, updateTestimonial } from "@/core/actions/testimonials";
import { useAction } from "../lib/use-action";
import { useServerState } from "../lib/use-server-state";
import { emptyToNull } from "../lib/format";
import { applyFieldErrors, validateWith } from "../lib/validate";
import { useUnsavedChanges } from "../lib/use-unsaved-changes";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { ConfirmDialog, Modal } from "../ui/dialogs";
import { CharCount, Field, Input, Select, Textarea, fieldA11y } from "../ui/field";
import { EmptyState, PageHeader } from "../ui/misc";
import { DragHandle, SortableContainer, SortableItem, moveItem } from "../ui/sortable";
import { Switch } from "../ui/switch";
import { MediaPickerField } from "../media/media-picker";

interface Props {
  testimonials: Testimonial[];
  brands: Brand[];
  media: MediaItem[];
}

function excerpt(quote: string, max = 90) {
  const clean = quote.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function TestimonialsManager({ testimonials, brands, media }: Props) {
  const [items, setItems] = useServerState(testimonials);
  const [editing, setEditing] = useState<Testimonial | "new" | null>(null);
  const [deleting, setDeleting] = useState<Testimonial | null>(null);
  const { run } = useAction();
  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  const attribution = (t: Testimonial) =>
    [t.authorName, t.authorRole, t.brandId ? brandById.get(t.brandId)?.name : null].filter(Boolean).join(" · ") || "Anonymous";

  function handleMove(from: number, to: number) {
    const previous = items;
    const next = moveItem(items, from, to);
    void run(() => reorderTestimonials(next.map((t) => t.id)), {
      optimistic: () => setItems(next),
      rollback: () => setItems(previous),
    });
  }

  function togglePublished(t: Testimonial, published: boolean) {
    const previous = items;
    void run(() => updateTestimonial(t.id, { published }), {
      success: published ? "Testimonial is visible" : "Testimonial is hidden",
      optimistic: () => setItems((list) => list.map((x) => (x.id === t.id ? { ...x, published } : x))),
      rollback: () => setItems(previous),
    });
  }

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="What brands say about working with you. Drag to set the order."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> New testimonial
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={<Quote />} title="No testimonials yet">
          Paste in feedback from brand partners. You can hide any of them later.
        </EmptyState>
      ) : (
        <SortableContainer ids={items.map((t) => t.id)} onMove={handleMove} getLabel={(id) => `testimonial from ${attribution(items.find((t) => t.id === id)!)}`}>
          <ul className="flex flex-col gap-2" aria-label="Testimonials">
            {items.map((t, index) => (
              <SortableItem key={t.id} id={t.id} className="rounded-lg border border-(--a-line) bg-(--a-surface)">
                {() => (
                  <div className="flex flex-wrap items-start gap-x-2 p-2 sm:flex-nowrap sm:gap-3">
                    <DragHandle label={`testimonial ${index + 1}`} />
                    <div className="min-w-48 flex-1 py-1">
                      <p className={cn("text-sm", t.published ? "text-(--a-ink)" : "text-(--a-ink-soft)")}>“{excerpt(t.quote)}”</p>
                      <p className="mt-1 truncate text-xs text-(--a-ink-soft)">
                        {attribution(t)}
                        {!t.published ? " · Hidden" : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                    <Switch label={`Show testimonial ${index + 1} on site`} checked={t.published} onCheckedChange={(v) => togglePublished(t, v)} className="px-1" />
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit testimonial ${index + 1}`} onClick={() => setEditing(t)}>
                      <Pencil />
                    </Button>
                    <Button variant="danger-ghost" size="icon-sm" aria-label={`Delete testimonial ${index + 1}`} onClick={() => setDeleting(t)}>
                      <Trash2 />
                    </Button>
                    </div>
                  </div>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContainer>
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        title={editing === "new" ? "New testimonial" : "Edit testimonial"}
        size="lg"
        modalLock
      >
        {editing !== null ? (
          <TestimonialForm
            key={editing === "new" ? "new" : editing.id}
            testimonial={editing === "new" ? null : editing}
            brands={brands}
            media={media}
            onCancel={() => setEditing(null)}
            onSaved={(saved, isNew) => {
              setItems((list) => (isNew ? [...list, saved] : list.map((t) => (t.id === saved.id ? saved : t))));
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the testimonial from ${deleting ? attribution(deleting) : ""}?`}
        description={deleting ? `“${excerpt(deleting.quote, 120)}” will be removed. This can't be undone.` : ""}
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          const result = await run(() => deleteTestimonial(target.id), { success: "Testimonial deleted" });
          if (result.ok) setItems((list) => list.filter((t) => t.id !== target.id));
          return result.ok;
        }}
      />
    </>
  );
}

interface FormValues {
  quote: string;
  authorName: string;
  authorRole: string;
  brandId: string;
  avatarMediaId: string | null;
  published: boolean;
}

function TestimonialForm({
  testimonial,
  brands,
  media,
  onCancel,
  onSaved,
}: {
  testimonial: Testimonial | null;
  brands: Brand[];
  media: MediaItem[];
  onCancel: () => void;
  onSaved: (t: Testimonial, isNew: boolean) => void;
}) {
  const { run } = useAction();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      quote: testimonial?.quote ?? "",
      authorName: testimonial?.authorName ?? "",
      authorRole: testimonial?.authorRole ?? "",
      brandId: testimonial?.brandId ?? "",
      avatarMediaId: testimonial?.avatarMediaId ?? null,
      published: testimonial?.published ?? true,
    },
  });
  useUnsavedChanges(isDirty);
  const quote = useWatch({ control, name: "quote" });

  const onSubmit = handleSubmit(async (values) => {
    const input: TestimonialInput = {
      quote: values.quote.trim(),
      authorName: emptyToNull(values.authorName),
      authorRole: emptyToNull(values.authorRole),
      brandId: values.brandId || null,
      avatarMediaId: values.avatarMediaId,
      published: values.published,
    };
    const parsed = validateWith(testimonialInputSchema, input, setError);
    if (!parsed) return;
    const result = testimonial
      ? await run(() => updateTestimonial(testimonial.id, parsed), { success: "Testimonial saved" })
      : await run(() => createTestimonial(parsed), { success: "Testimonial added" });
    if (result.ok) onSaved(result.data, !testimonial);
    else applyFieldErrors(result.fieldErrors, setError);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field id="t-quote" label="Quote" aside={<CharCount value={quote ?? ""} max={3000} />} error={errors.quote?.message}>
        <Textarea {...fieldA11y("t-quote", errors.quote?.message)} rows={6} autoFocus {...register("quote")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="t-name" label="Name" hint="Optional" error={errors.authorName?.message}>
          <Input {...fieldA11y("t-name", errors.authorName?.message, true)} {...register("authorName")} />
        </Field>
        <Field id="t-role" label="Role" hint="e.g. Marketing lead" error={errors.authorRole?.message}>
          <Input {...fieldA11y("t-role", errors.authorRole?.message, true)} {...register("authorRole")} />
        </Field>
        <Field id="t-brand" label="Brand" error={errors.brandId?.message}>
          <Select {...fieldA11y("t-brand", errors.brandId?.message)} {...register("brandId")}>
            <option value="">None</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Controller
        control={control}
        name="avatarMediaId"
        render={({ field }) => (
          <MediaPickerField id="t-avatar" label="Photo" hint="Optional photo or logo next to the quote." media={media} value={field.value} onChange={field.onChange} imagesOnly />
        )}
      />
      <Controller
        control={control}
        name="published"
        render={({ field }) => <Switch showLabel label="Published (visible on site)" checked={field.value} onCheckedChange={field.onChange} />}
      />
      <div className="flex justify-end gap-2 border-t border-(--a-line) pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" pending={isSubmitting}>
          {testimonial ? "Save" : "Add testimonial"}
        </Button>
      </div>
    </form>
  );
}
