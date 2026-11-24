import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "ghost" | "paper";

const variants: Record<Variant, string> = {
  // The one Von Restorff element per view: rose-deep on cream (5.1:1).
  primary:
    "bg-(--rose-deep) text-(--cream) shadow-[0_10px_24px_-12px_rgb(44_17_25/0.7)] hover:bg-(--rose-deeper)",
  ghost: "border-[1.5px] border-(--ink) text-(--ink) hover:bg-(--ink) hover:text-(--cream)",
  paper: "bg-(--cream) text-(--rose-deeper) hover:bg-(--cream-2)",
};

export const buttonClass = (variant: Variant = "primary", className?: string) =>
  cn(
    "inline-flex min-h-12 select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-full px-6 text-[0.95rem] font-semibold",
    "transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]",
    variants[variant],
    className,
  );

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
  external,
  ...rest
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
  external?: boolean;
} & Omit<ComponentProps<"a">, "href" | "className" | "children">) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, className)} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, className)} {...rest}>
      {children}
    </Link>
  );
}
