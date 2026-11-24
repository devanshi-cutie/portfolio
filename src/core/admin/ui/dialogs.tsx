"use client";

import { useState, type ReactNode } from "react";
import { AlertDialog, Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { keepOpenWhileUploading } from "../upload/widget-state";
import { useAdminPortalContainer } from "./portal";

/* ----------------------------------------------------------------- modal */

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  /** prevent closing by outside click (long forms) */
  modalLock?: boolean;
}

const modalSizes = { md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" } as const;

export function Modal({ open, onOpenChange, title, description, children, footer, size = "md", modalLock }: ModalProps) {
  const container = useAdminPortalContainer();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="adm-overlay fixed inset-0 z-50 bg-(--a-overlay)" />
        <Dialog.Content
          onInteractOutside={(e) => (modalLock ? e.preventDefault() : keepOpenWhileUploading(e))}
          onEscapeKeyDown={keepOpenWhileUploading}
          className={cn(
            "adm-modal fixed z-50 flex max-h-[92dvh] w-full flex-col bg-(--a-surface) shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--a-ink)_45%,transparent)] outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            modalSizes[size],
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-(--a-line) px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title className="adm-display text-lg font-semibold text-(--a-ink)">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-(--a-ink-soft)">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Dialog</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-2 -mt-1">
                <X />
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-(--a-line) px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ----------------------------------------------------------------- sheet */

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  side?: "left" | "right";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Sheet({ open, onOpenChange, title, description, side = "right", children, footer, className }: SheetProps) {
  const container = useAdminPortalContainer();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="adm-overlay fixed inset-0 z-50 bg-(--a-overlay)" />
        <Dialog.Content
          onInteractOutside={keepOpenWhileUploading}
          onEscapeKeyDown={keepOpenWhileUploading}
          className={cn(
            "fixed inset-y-0 z-50 flex w-full flex-col bg-(--a-surface) shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--a-ink)_45%,transparent)] outline-none",
            side === "right" ? "adm-sheet-right right-0 sm:max-w-xl" : "adm-sheet-left left-0 max-w-[85vw] sm:max-w-xs",
            className,
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-(--a-line) px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title className="adm-display truncate text-lg font-semibold text-(--a-ink)">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-(--a-ink-soft)">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Panel</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-2 -mt-1">
                <X />
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center gap-2 border-t border-(--a-line) px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* --------------------------------------------------------------- confirm */

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  /** return false to keep the dialog open (e.g. the action failed) */
  onConfirm: () => Promise<boolean | void> | boolean | void;
  destructive?: boolean;
  children?: ReactNode;
}

/** Confirmation for destructive actions. Focus starts on Cancel. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  destructive = true,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const container = useAdminPortalContainer();

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await onConfirm();
      if (result !== false) onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialog.Portal container={container}>
        <AlertDialog.Overlay className="adm-overlay fixed inset-0 z-[80] bg-(--a-overlay)" />
        <AlertDialog.Content className="adm-modal fixed inset-x-0 bottom-0 z-[80] w-full rounded-t-xl bg-(--a-surface) p-5 shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--a-ink)_45%,transparent)] outline-none sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <AlertDialog.Title className="adm-display text-lg font-semibold text-(--a-ink)">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-(--a-ink-soft)">{description}</AlertDialog.Description>
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-5 flex flex-col-reverse gap-2 pb-[env(safe-area-inset-bottom)] sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? "danger" : "primary"} pending={pending} onClick={handleConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
