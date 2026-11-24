import type { ReactNode } from "react";
import { cn } from "../lib/cn";

const badgeTones = {
  neutral: "bg-(--a-muted) text-(--a-ink-soft) ring-(--a-line)",
  dark: "bg-(--a-ink)/80 text-(--a-primary-ink) ring-transparent backdrop-blur-sm",
  amber: "bg-(--a-warn-bg) text-(--a-ink) ring-(--a-warn-line)",
  green: "bg-(--a-blush) text-(--a-ink) ring-(--a-highlight)",
  rose: "bg-(--a-blush) text-(--a-ink) ring-(--a-highlight)",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof badgeTones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset [&_svg]:size-3",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-(--a-ink)">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-sm text-(--a-ink-soft)">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, description, actions, className, children }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border border-(--a-line) bg-(--a-surface)", className)}>
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-(--a-line) px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-(--a-ink)">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-(--a-ink-soft)">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center rounded-lg border border-dashed border-(--a-line-strong) bg-(--a-surface) px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-(--a-ink-faint) [&_svg]:size-8">{icon}</div> : null}
      <p className="text-sm font-medium text-(--a-ink)">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-(--a-ink-soft)">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-(--a-muted-strong)/70 motion-reduce:animate-none", className)} />;
}

export function PageSkeleton({ grid = false }: { grid?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {grid ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}
    </div>
  );
}
