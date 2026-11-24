import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";

export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-(--a-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--a-surface)";

const variants = {
  primary: "bg-(--a-primary) text-(--a-primary-ink) hover:bg-(--a-primary-hover) active:bg-(--a-primary-press) shadow-[0_1px_0_color-mix(in_oklab,var(--a-ink)_18%,transparent)]",
  secondary: "bg-(--a-surface) text-(--a-ink) border border-(--a-line-strong) hover:bg-(--a-muted) active:bg-(--a-muted) shadow-xs",
  ghost: "text-(--a-ink-soft) hover:bg-(--a-muted) hover:text-(--a-ink) active:bg-(--a-muted-strong)",
  danger: "bg-red-700 text-white hover:bg-red-800 active:bg-red-900 shadow-sm",
  "danger-ghost": "text-red-700 hover:bg-red-50 active:bg-red-100",
} as const;

const sizes = {
  sm: "h-11 sm:pointer-fine:h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-11 sm:pointer-fine:h-9 px-4 text-sm gap-2",
  icon: "size-11 sm:pointer-fine:size-9 justify-center",
  "icon-sm": "size-11 sm:pointer-fine:size-8 justify-center",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  pending?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", pending = false, asChild = false, className, children, disabled, type, ...props },
  ref,
) {
  const classes = cn(
    "inline-flex shrink-0 cursor-pointer items-center rounded-full font-medium whitespace-nowrap select-none",
    "transition-[background-color,color,box-shadow,opacity] duration-100 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    focusRing,
    variants[variant],
    sizes[size],
    className,
  );
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
