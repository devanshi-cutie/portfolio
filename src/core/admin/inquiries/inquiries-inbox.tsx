"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, Inbox, Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import type { Inquiry, InquiryStatus } from "@/core/types/content";
import { deleteInquiry, setInquiryStatus } from "@/core/actions/inquiries";
import { useAction } from "../lib/use-action";
import { useServerState } from "../lib/use-server-state";
import { cn } from "../lib/cn";
import { Button, focusRing } from "../ui/button";
import { ConfirmDialog, Sheet } from "../ui/dialogs";
import { EmptyState, PageHeader } from "../ui/misc";
import { LocalDateTime } from "./local-date";

type Tab = "inbox" | "new" | "archived" | "all";

const TABS: { value: Tab; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "new", label: "Unread" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

function matches(tab: Tab, status: InquiryStatus) {
  if (tab === "all") return true;
  if (tab === "inbox") return status !== "archived";
  return status === tab;
}

const desktopQuery = "(min-width: 768px)";
function subscribe(callback: () => void) {
  const mql = window.matchMedia(desktopQuery);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(desktopQuery).matches, () => true);
}

export function InquiriesInbox({ inquiries }: { inquiries: Inquiry[] }) {
  const searchParams = useSearchParams();
  const [items, setItems] = useServerState(inquiries);
  const [tab, setTab] = useState<Tab>("inbox");
  const [openId, setOpenId] = useState<string | null>(() => searchParams?.get("open") ?? null);
  const [deleting, setDeleting] = useState<Inquiry | null>(null);
  const isDesktop = useIsDesktop();
  const { run, busyKey } = useAction();

  const visible = useMemo(() => items.filter((i) => matches(tab, i.status)), [items, tab]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { inbox: 0, new: 0, archived: 0, all: items.length };
    for (const i of items) {
      if (i.status !== "archived") c.inbox++;
      if (i.status === "new") c.new++;
      if (i.status === "archived") c.archived++;
    }
    return c;
  }, [items]);
  const current = openId ? (items.find((i) => i.id === openId) ?? null) : null;

  function changeStatus(inquiry: Inquiry, status: InquiryStatus, message?: string) {
    const previous = items;
    return run(() => setInquiryStatus(inquiry.id, status), {
      key: `status-${status}`,
      success: message,
      refresh: false, // the action refreshes the route itself
      optimistic: () => setItems((list) => list.map((i) => (i.id === inquiry.id ? { ...i, status } : i))),
      rollback: () => setItems(previous),
    });
  }

  function open(inquiry: Inquiry) {
    setOpenId(inquiry.id);
    if (inquiry.status === "new") void changeStatus(inquiry, "read");
  }

  const detail = current ? (
    <InquiryDetail
      inquiry={current}
      busyKey={busyKey}
      onStatus={(status, message) => void changeStatus(current, status, message)}
      onDelete={() => setDeleting(current)}
    />
  ) : null;

  return (
    <>
      <PageHeader title="Inquiries" description="Messages sent through the contact form on your site." />

      <div role="tablist" aria-label="Filter inquiries" className="mb-4 flex gap-1 overflow-x-auto border-b border-(--a-line)">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "-mb-px flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-(--a-ink-soft) hover:text-(--a-ink) sm:pointer-fine:h-10",
              tab === t.value && "border-(--a-primary) font-medium text-(--a-ink)",
              focusRing,
            )}
          >
            {t.label}
            <span className="rounded bg-(--a-muted) px-1.5 text-xs tabular-nums text-(--a-ink-soft)">{counts[t.value]}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Inbox />} title="No inquiries yet">
          When a brand fills in the contact form on your site, their message shows up here.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
            {visible.length === 0 ? (
              <p className="rounded-lg border border-dashed border-(--a-line-strong) bg-(--a-surface) py-10 text-center text-sm text-(--a-ink-soft)">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-(--a-line) overflow-hidden rounded-lg border border-(--a-line) bg-(--a-surface)">
                {visible.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => open(i)}
                      aria-current={i.id === openId ? "true" : undefined}
                      className={cn(
                        "flex w-full cursor-pointer flex-col gap-0.5 px-3 py-3 text-left transition-colors duration-100 hover:bg-(--a-muted)",
                        i.id === openId && "bg-(--a-muted) hover:bg-(--a-muted)",
                        focusRing,
                        "focus-visible:ring-inset focus-visible:ring-offset-0",
                      )}
                    >
                      <span className="flex items-baseline gap-2">
                        {i.status === "new" ? <span className="size-2 shrink-0 rounded-full bg-(--a-highlight)" aria-label="Unread" role="img" /> : null}
                        <span className={cn("min-w-0 flex-1 truncate text-sm", i.status === "new" ? "font-semibold text-(--a-ink)" : "text-(--a-ink)")}>
                          {i.name}
                          {i.company ? <span className="font-normal text-(--a-ink-soft)"> · {i.company}</span> : null}
                        </span>
                        <LocalDateTime iso={i.createdAt} className="shrink-0 text-xs text-(--a-ink-soft)" />
                      </span>
                      <span className="line-clamp-2 text-[13px] text-(--a-ink-soft)">{i.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isDesktop ? (
            <div className="hidden md:block">
              <div className="sticky top-20">
                {detail ?? (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-(--a-line-strong) text-sm text-(--a-ink-soft)">
                    Select a message to read it.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Sheet open={current !== null} onOpenChange={(v) => !v && setOpenId(null)} title={current?.name ?? "Inquiry"} description={current?.company ?? undefined}>
              {detail}
            </Sheet>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete the message from ${deleting?.name ?? ""}?`}
        description="It's removed permanently. Archive it instead if you might need it later."
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          const result = await run(() => deleteInquiry(target.id), { success: "Message deleted", refresh: false });
          if (result.ok) {
            setItems((list) => list.filter((i) => i.id !== target.id));
            if (openId === target.id) setOpenId(null);
          }
          return result.ok;
        }}
      />
    </>
  );
}

function InquiryDetail({
  inquiry,
  busyKey,
  onStatus,
  onDelete,
}: {
  inquiry: Inquiry;
  busyKey: string | null;
  onStatus: (status: InquiryStatus, message?: string) => void;
  onDelete: () => void;
}) {
  const subject = `Re: your enquiry${inquiry.company ? ` (${inquiry.company})` : ""}`;
  const firstName = inquiry.name.split(/\s+/)[0] ?? "";
  const mailto = `mailto:${encodeURIComponent(inquiry.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hi ${firstName},\n\n`)}`;

  return (
    <article className="rounded-lg border border-(--a-line) bg-(--a-surface)" aria-label={`Message from ${inquiry.name}`}>
      <header className="border-b border-(--a-line) px-4 py-3">
        <h2 className="text-base font-semibold text-(--a-ink)">{inquiry.name}</h2>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-(--a-ink-soft)">Email</dt>
          <dd className="min-w-0 truncate">
            <a href={`mailto:${inquiry.email}`} className="text-(--a-ink) underline underline-offset-2">
              {inquiry.email}
            </a>
          </dd>
          {inquiry.company ? (
            <>
              <dt className="text-(--a-ink-soft)">Brand</dt>
              <dd>{inquiry.company}</dd>
            </>
          ) : null}
          {inquiry.budget ? (
            <>
              <dt className="text-(--a-ink-soft)">Budget</dt>
              <dd>{inquiry.budget}</dd>
            </>
          ) : null}
          <dt className="text-(--a-ink-soft)">Sent</dt>
          <dd>
            <LocalDateTime iso={inquiry.createdAt} />
          </dd>
        </dl>
      </header>
      <p className="px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap text-(--a-ink)">{inquiry.message}</p>
      <footer className="flex flex-wrap items-center gap-2 border-t border-(--a-line) px-4 py-3">
        <Button asChild variant="primary" size="sm">
          <a href={mailto}>
            <Reply aria-hidden /> Reply by email
          </a>
        </Button>
        {inquiry.status === "new" ? (
          <Button size="sm" pending={busyKey === "status-read"} onClick={() => onStatus("read")}>
            <MailOpen aria-hidden /> Mark read
          </Button>
        ) : (
          <Button size="sm" pending={busyKey === "status-new"} onClick={() => onStatus("new", "Marked unread")}>
            <Mail aria-hidden /> Mark unread
          </Button>
        )}
        {inquiry.status === "archived" ? (
          <Button size="sm" pending={busyKey === "status-read"} onClick={() => onStatus("read", "Moved to inbox")}>
            <ArchiveRestore aria-hidden /> Move to inbox
          </Button>
        ) : (
          <Button size="sm" pending={busyKey === "status-archived"} onClick={() => onStatus("archived", "Archived")}>
            <Archive aria-hidden /> Archive
          </Button>
        )}
        <Button size="sm" variant="danger-ghost" className="ml-auto" onClick={onDelete}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </footer>
    </article>
  );
}
