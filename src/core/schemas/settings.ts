import { z } from "zod";
import { SECTION_KEYS } from "@/core/types/content";
import type {
  BrandGroup,
  Highlight,
  ProcessStep,
  SectionConfig,
  SectionKey,
  Service,
  SiteSettings,
  SocialLink,
  Stat,
} from "@/core/types/content";
import { idSchema, linkSchema } from "./common";

const text = (max: number) => z.string().trim().max(max);
const mediaId = idSchema.nullable();

const socialLinkSchema = z.object({
  platform: text(40).min(1),
  label: text(80),
  url: linkSchema,
});

const brandGroupSchema = z.object({
  tag: text(40)
    .min(1, "Required")
    .regex(/^[^A-Z]*$/, "Use lowercase (tags are stored lowercase)"),
  label: text(120),
});

const statSchema = z.object({ value: text(40), label: text(120) });
const highlightSchema = z.object({ title: text(120), body: text(1000) });
const serviceSchema = z.object({
  title: text(120),
  description: text(1000),
  deliverables: z.array(text(160)).max(20),
});
const processStepSchema = z.object({ title: text(120), body: text(1000) });

const sectionSchema = z.object({
  key: z.enum(SECTION_KEYS as unknown as [SectionKey, ...SectionKey[]]),
  enabled: z.boolean(),
  eyebrow: text(120),
  title: text(200),
  subtitle: text(600),
});

/** Strict validation for `updateSettings()` and the admin forms. */
export const siteSettingsSchema = z.object({
  identity: z.object({
    name: text(120),
    handle: text(60).regex(/^[^@\s]*$/, "Without @ or spaces"),
    role: text(120),
    location: text(120),
    tagline: text(300),
    shortBio: text(1000),
    longBio: text(5000),
    portraitMediaId: mediaId,
    heroMediaId: mediaId,
    keywords: z.array(text(60)).max(30),
  }),
  contact: z.object({
    email: z.union([z.literal(""), z.email().max(254)]),
    phone: text(40),
    whatsapp: text(20).regex(/^\d*$/, "Digits only, with country code"),
    ctaLabel: text(80),
    availability: text(200),
    mediaKitUrl: linkSchema,
    budgetOptions: z.array(text(80).min(1)).max(12),
  }),
  socials: z.array(socialLinkSchema).max(20),
  brandGroups: z
    .array(brandGroupSchema)
    .max(20)
    .refine((list) => new Set(list.map((g) => g.tag)).size === list.length, "Each brand tag may appear once"),
  stats: z.array(statSchema).max(20),
  highlights: z.array(highlightSchema).max(20),
  services: z.array(serviceSchema).max(20),
  process: z.array(processStepSchema).max(20),
  sections: z
    .array(sectionSchema)
    .max(SECTION_KEYS.length)
    .refine((list) => new Set(list.map((s) => s.key)).size === list.length, "Each section may appear once"),
  seo: z.object({
    title: text(200),
    description: text(500),
    ogImageMediaId: mediaId,
  }),
  theme: z.record(text(60), text(500)),
}) satisfies z.ZodType<SiteSettings>;

/* --------------------------------------------------------- normalization */

/** Neutral, creator-agnostic defaults: every key present, nothing personal. */
export function defaultSettings(): SiteSettings {
  return {
    identity: {
      name: "",
      handle: "",
      role: "",
      location: "",
      tagline: "",
      shortBio: "",
      longBio: "",
      portraitMediaId: null,
      heroMediaId: null,
      keywords: [],
    },
    contact: {
      email: "",
      phone: "",
      whatsapp: "",
      ctaLabel: "Get in touch",
      availability: "",
      mediaKitUrl: "",
      budgetOptions: [],
    },
    socials: [],
    brandGroups: [
      { tag: "ugc", label: "UGC content" },
      { tag: "instagram", label: "Instagram collaborations" },
    ],
    stats: [],
    highlights: [],
    services: [],
    process: [],
    sections: SECTION_KEYS.map((key) => ({ key, enabled: true, eyebrow: "", title: "", subtitle: "" })),
    seo: { title: "", description: "", ogImageMediaId: null },
    theme: {},
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const idOrNull = (v: unknown, fallback: string | null): string | null =>
  typeof v === "string" && v !== "" ? v : v === null ? null : fallback;
const strList = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : fallback;
/** Map an array through `item`, dropping entries that are not objects. Non-arrays fall back. */
const objList = <T>(v: unknown, fallback: T[], item: (o: Obj) => T): T[] =>
  Array.isArray(v) ? v.filter(isObj).map(item) : fallback;

const isSectionKey = (v: unknown): v is SectionKey =>
  typeof v === "string" && (SECTION_KEYS as readonly string[]).includes(v);

function normalizeBrandGroups(raw: unknown, defaults: BrandGroup[]): BrandGroup[] {
  if (!Array.isArray(raw)) return defaults;
  const seen = new Set<string>();
  const out: BrandGroup[] = [];
  for (const entry of raw) {
    if (!isObj(entry) || typeof entry.tag !== "string") continue;
    const tag = entry.tag.trim().toLowerCase();
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    out.push({ tag, label: str(entry.label, "") });
  }
  return out;
}

function normalizeSections(raw: unknown, defaults: SectionConfig[]): SectionConfig[] {
  const stored: SectionConfig[] = [];
  const seen = new Set<SectionKey>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isObj(entry) || !isSectionKey(entry.key) || seen.has(entry.key)) continue;
      seen.add(entry.key);
      stored.push({
        key: entry.key,
        enabled: bool(entry.enabled, true),
        eyebrow: str(entry.eyebrow, ""),
        title: str(entry.title, ""),
        subtitle: str(entry.subtitle, ""),
      });
    }
  }
  if (stored.length === 0) return defaults;
  // Keep the stored order; append any section the stored list is missing, disabled.
  for (const key of SECTION_KEYS) {
    if (!seen.has(key)) stored.push({ key, enabled: false, eyebrow: "", title: "", subtitle: "" });
  }
  return stored;
}

/**
 * Deep-merges stored settings (jsonb, possibly partial or from an older shape)
 * over neutral defaults. Always returns a complete `SiteSettings`; wrong types
 * fall back to the default, so a bad key never crashes a theme.
 */
export function normalizeSettings(raw: unknown): SiteSettings {
  const d = defaultSettings();
  const r = isObj(raw) ? raw : {};
  const identity = isObj(r.identity) ? r.identity : {};
  const contact = isObj(r.contact) ? r.contact : {};
  const seo = isObj(r.seo) ? r.seo : {};

  const theme: Record<string, string> = {};
  if (isObj(r.theme)) {
    for (const [k, v] of Object.entries(r.theme)) if (typeof v === "string") theme[k] = v;
  }

  return {
    identity: {
      name: str(identity.name, d.identity.name),
      handle: str(identity.handle, d.identity.handle).replace(/^@/, ""),
      role: str(identity.role, d.identity.role),
      location: str(identity.location, d.identity.location),
      tagline: str(identity.tagline, d.identity.tagline),
      shortBio: str(identity.shortBio, d.identity.shortBio),
      longBio: str(identity.longBio, d.identity.longBio),
      portraitMediaId: idOrNull(identity.portraitMediaId, d.identity.portraitMediaId),
      heroMediaId: idOrNull(identity.heroMediaId, d.identity.heroMediaId),
      keywords: strList(identity.keywords, d.identity.keywords),
    },
    contact: {
      email: str(contact.email, d.contact.email),
      phone: str(contact.phone, d.contact.phone),
      whatsapp: str(contact.whatsapp, d.contact.whatsapp),
      ctaLabel: str(contact.ctaLabel, d.contact.ctaLabel),
      availability: str(contact.availability, d.contact.availability),
      mediaKitUrl: str(contact.mediaKitUrl, d.contact.mediaKitUrl),
      budgetOptions: strList(contact.budgetOptions, d.contact.budgetOptions).filter((o) => o.trim() !== ""),
    },
    socials: objList<SocialLink>(r.socials, d.socials, (o) => ({
      platform: str(o.platform, "website"),
      label: str(o.label, ""),
      url: str(o.url, ""),
    })),
    brandGroups: normalizeBrandGroups(r.brandGroups, d.brandGroups),
    stats: objList<Stat>(r.stats, d.stats, (o) => ({ value: str(o.value, ""), label: str(o.label, "") })),
    highlights: objList<Highlight>(r.highlights, d.highlights, (o) => ({
      title: str(o.title, ""),
      body: str(o.body, ""),
    })),
    services: objList<Service>(r.services, d.services, (o) => ({
      title: str(o.title, ""),
      description: str(o.description, ""),
      deliverables: strList(o.deliverables, []),
    })),
    process: objList<ProcessStep>(r.process, d.process, (o) => ({
      title: str(o.title, ""),
      body: str(o.body, ""),
    })),
    sections: normalizeSections(r.sections, d.sections),
    seo: {
      title: str(seo.title, d.seo.title),
      description: str(seo.description, d.seo.description),
      ogImageMediaId: idOrNull(seo.ogImageMediaId, d.seo.ogImageMediaId),
    },
    theme,
  };
}
