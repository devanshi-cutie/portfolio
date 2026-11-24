"use client";

import { Switch as RadixSwitch } from "radix-ui";
import { cn } from "../lib/cn";
import { focusRing } from "./button";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  /** show the label next to the switch; otherwise it is only announced */
  showLabel?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, showLabel = false, disabled, id, className }: SwitchProps) {
  const control = (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={showLabel ? undefined : label}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-(--a-line-strong) transition-colors duration-150 ease-out",
        "data-[state=checked]:bg-(--a-primary) disabled:cursor-not-allowed disabled:opacity-50",
        // 44px touch target without changing the visual size
        "before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']",
        focusRing,
      )}
    >
      <RadixSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-(--a-surface) shadow-sm transition-transform duration-150 ease-out data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
    </RadixSwitch.Root>
  );
  if (!showLabel) return <span className={cn("inline-flex", className)}>{control}</span>;
  return (
    <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-(--a-ink) sm:pointer-fine:min-h-9", className)}>
      {control}
      <span>{label}</span>
    </label>
  );
}
