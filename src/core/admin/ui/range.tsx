"use client";

import { useId, type ReactNode } from "react";
import { Slider } from "radix-ui";
import { cn } from "../lib/cn";

interface RangeProps {
  label: string;
  /** one value, or two for a start/end range */
  value: number[];
  onChange: (value: number[]) => void;
  /** fires once when the user lets go */
  onCommit?: (value: number[]) => void;
  min: number;
  max: number;
  step?: number;
  /** text shown at the right of the label, e.g. "1.4×" */
  display?: ReactNode;
  /** accessible names for each thumb (defaults to the label) */
  thumbLabels?: string[];
  /** formats a thumb value for screen readers */
  valueText?: (value: number) => string;
  disabled?: boolean;
  /** show a tick at this value, e.g. 0 for centred sliders */
  centre?: number;
  className?: string;
}

/** Labelled Radix slider with a 44px-tall hit area on touch. */
export function Range({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  display,
  thumbLabels,
  valueText,
  disabled,
  centre,
  className,
}: RangeProps) {
  const id = useId();
  const centrePct = centre === undefined ? null : ((centre - min) / (max - min)) * 100;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span id={id} className="text-[13px] font-medium text-(--a-ink)">
          {label}
        </span>
        {display !== undefined ? <span className="text-xs tabular-nums text-(--a-ink-soft)">{display}</span> : null}
      </div>
      <Slider.Root
        aria-labelledby={id}
        className="relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-50 sm:pointer-fine:h-7"
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onChange}
        onValueCommit={onCommit}
        disabled={disabled}
        minStepsBetweenThumbs={value.length > 1 ? 1 : undefined}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-(--a-muted-strong)">
          {centrePct !== null ? (
            <span aria-hidden className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-(--a-ink-soft)" style={{ left: `${centrePct}%` }} />
          ) : null}
          <Slider.Range className="absolute h-full rounded-full bg-(--a-primary)" />
        </Slider.Track>
        {value.map((v, i) => (
          <Slider.Thumb
            key={i}
            aria-label={thumbLabels?.[i] ?? label}
            aria-valuetext={valueText?.(v)}
            className="block size-5 cursor-grab rounded-full border-2 border-(--a-primary) bg-(--a-surface) shadow outline-none focus-visible:ring-2 focus-visible:ring-(--a-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--a-surface) active:cursor-grabbing"
          />
        ))}
      </Slider.Root>
    </div>
  );
}
