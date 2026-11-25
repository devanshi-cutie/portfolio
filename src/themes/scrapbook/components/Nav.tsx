"use client";

/**
 * Minimal sticky bar: name lockup, anchors, the one burgundy CTA. It gains a
 * paper backdrop and tightens once the page scrolls. On small screens the
 * menu grows out of the burger as a circle (clip-path), closes faster than it
 * opens, traps focus and returns it to the burger.
 */
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useIsPresent, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { trackAttr } from "@/core/lib/track-events";
import { cn } from "../lib/cn";
import { EASE_IN, EASE_OUT } from "../motion/easing";
import { buttonClass } from "./Button";

export interface NavLink {
  href: string;
  label: string;
}

export function Nav({
  name,
  links,
  cta,
  instagram,
  handle,
}: {
  name: string;
  links: NavLink[];
  cta: NavLink | null;
  instagram: string;
  handle: string;
}) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const burger = useRef<HTMLButtonElement>(null);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));
  const active = useActiveSection(links);

  const [first, ...rest] = name.trim().split(/\s+/);

  const toggle = () => {
    if (!open && burger.current) {
      const r = burger.current.getBoundingClientRect();
      setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "z-[65]" : "z-50",
          scrolled && !open ? "bg-(--cream)/88 shadow-[0_1px_0_var(--line)] backdrop-blur-md" : "bg-transparent",
        )}
      >
        <nav
          aria-label="Main"
          className={cn(
            "mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-(--gutter) transition-[height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            scrolled ? "h-14" : "h-(--nav-h)",
          )}
        >
          <Link
            href="/"
            className={cn("relative z-[61] flex min-h-11 items-center gap-2", open ? "text-(--cream)" : "text-(--ink)")}
            aria-label={`${name}, home`}
          >
            <span aria-hidden className={cn("sb-arch text-[1.1rem]", open ? "text-(--cream)" : "text-(--rose-deep)")} />
            <span className="sb-display text-[1.35rem] leading-none">
              {first}
              {rest.length ? <em className="sb-accent"> {rest.join(" ")}</em> : null}
            </span>
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active === l.href ? "location" : undefined}
                  className="group relative inline-flex min-h-11 items-center px-3 text-[0.95rem] font-medium text-(--ink)"
                >
                  {l.label}
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-2 h-[1.5px] origin-left scale-x-0 bg-(--rose-deep) transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 group-aria-[current=location]:scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            {cta && !open ? (
              <Link
                href={cta.href}
                data-track={trackAttr("cta_click", "nav")}
                className={buttonClass("primary", "hidden min-h-11 px-5 text-sm sm:inline-flex")}
              >
                {cta.label}
              </Link>
            ) : null}
            <button
              ref={burger}
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls="sb-mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className={cn(
                "relative z-[61] grid size-12 place-items-center rounded-full transition-colors duration-150 lg:hidden",
                open ? "text-(--cream) hover:bg-(--cream)/10" : "text-(--ink) hover:bg-(--cream-2)",
              )}
            >
              {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open ? (
          <MobileMenu
            links={links}
            active={active}
            cta={cta}
            origin={origin}
            instagram={instagram}
            handle={handle}
            onClose={() => setOpen(false)}
            returnFocus={burger}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function MobileMenu({
  links,
  active,
  cta,
  origin,
  instagram,
  handle,
  onClose,
  returnFocus,
}: {
  links: NavLink[];
  active: string | null;
  cta: NavLink | null;
  origin: { x: number; y: number };
  instagram: string;
  handle: string;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const at = `${origin.x}px ${origin.y}px`;

  const [prevOverflow] = useState(() => document.documentElement.style.overflow);
  const present = useIsPresent();

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
  }, []);

  // Give scroll and focus back as soon as the close starts.
  useEffect(() => {
    const burger = returnFocus.current;
    const giveBack = () => {
      document.documentElement.style.overflow = prevOverflow;
      burger?.focus({ preventScroll: true });
    };
    if (!present) giveBack();
    return () => {
      if (present) giveBack();
    };
  }, [present, prevOverflow, returnFocus]);

  useEffect(() => {
    if (!present) return;
    const burger = returnFocus.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        // the burger (close) stays reachable: it sits above the panel
        const nodes = [burger, ...Array.from(panel.current.querySelectorAll<HTMLElement>("a[href]"))].filter(
          Boolean,
        ) as HTMLElement[];
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          nodes[nodes.length - 1].focus();
        } else if (!e.shiftKey && i === nodes.length - 1) {
          e.preventDefault();
          nodes[0].focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, present, returnFocus]);

  return (
    <motion.div
      ref={panel}
      id="sb-mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="sb-on-dark fixed inset-0 z-[60] flex flex-col justify-between bg-(--rose-deep) px-(--gutter) pb-10 pt-28 text-(--cream) lg:hidden"
      initial={reduce ? { opacity: 0 } : { clipPath: `circle(0px at ${at})` }}
      animate={
        reduce
          ? { opacity: 1, transition: { duration: 0.2 } }
          : { clipPath: `circle(150% at ${at})`, transition: { duration: 0.4, ease: EASE_OUT } }
      }
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.12 } }
          : { clipPath: `circle(0px at ${at})`, transition: { duration: 0.22, ease: EASE_IN } }
      }
    >
      <ul className="flex flex-col gap-1">
        {links.map((l, i) => (
          <motion.li
            key={l.href}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT, delay: 0.08 + i * 0.04 } }}
          >
            <Link
              href={l.href}
              onClick={onClose}
              aria-current={active === l.href ? "location" : undefined}
              className="sb-display inline-flex min-h-14 items-center gap-3 text-[2.6rem] aria-[current=location]:italic"
            >
              {l.label}
              {active === l.href ? <span aria-hidden className="size-2 rounded-full bg-(--blush)" /> : null}
            </Link>
          </motion.li>
        ))}
      </ul>
      <div className="flex flex-col items-start gap-5">
        {cta ? (
          <Link href={cta.href} onClick={onClose} data-track={trackAttr("cta_click", "nav")} className={buttonClass("paper")}>
            {cta.label}
          </Link>
        ) : null}
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          data-track={trackAttr("social_click", "instagram-nav")}
          className="inline-flex min-h-11 items-center text-base font-semibold underline decoration-(--blush) underline-offset-4"
        >
          @{handle} on Instagram
        </a>
      </div>
    </motion.div>
  );
}

/** The nav link whose section is crossing the middle of the viewport. */
function useActiveSection(links: NavLink[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = links.map((l) => l.href).join("|");
  useEffect(() => {
    const hrefs = key.split("|").filter(Boolean);
    const targets = hrefs
      .map((h) => [h, document.getElementById(h.split("#")[1] ?? "")] as const)
      .filter((t): t is readonly [string, HTMLElement] => Boolean(t[1]));
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const hit = targets.find((t) => t[1] === e.target);
          if (!hit) continue;
          if (e.isIntersecting) setActive(hit[0]);
          else setActive((cur) => (cur === hit[0] ? null : cur));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    targets.forEach((t) => io.observe(t[1]));
    return () => io.disconnect();
  }, [key]);
  return active;
}
