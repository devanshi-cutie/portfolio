/**
 * Social preview card (Open Graph / X) for the scrapbook theme: the creator's
 * photo in the arch frame on the left, name + role + tagline + brands on the
 * right, on cream paper with a faint jaali lattice. Rendered by
 * next/og (Satori), so: flexbox only, inline styles, fonts passed explicitly.
 *
 * Server-only and free of next/font and client code, so the image route can
 * import it without pulling in the rest of the theme.
 */
import type { ReactElement } from "react";
import { imageUrl } from "@/core/cloudinary/urls";
import { isLocalPublicId } from "@/core/cloudinary/paths";
import type { SiteContent } from "@/core/types/content";
import type { ShareCard, ShareCardFont } from "../types";
import { portraitOf, resolveMedia } from "./lib/media";
import { palette } from "./palette";

const W = 1200;
const H = 630;

/** Google Fonts serves TTF (which Satori needs) to old user agents. */
async function googleFont(query: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`, { headers: { "User-Agent": "Mozilla/4.0" } })).text();
    const url = css.match(/url\(([^)]+)\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function loadFonts(): Promise<ShareCardFont[]> {
  const [display, displayItalic, body, bodyBold] = await Promise.all([
    googleFont("family=Fraunces:opsz,wght@144,600"),
    googleFont("family=Fraunces:ital,opsz,wght@1,144,600"),
    googleFont("family=Instrument+Sans:wght@500"),
    googleFont("family=Instrument+Sans:wght@700"),
  ]);
  const fonts: ShareCardFont[] = [];
  if (display) fonts.push({ name: "Display", data: display, weight: 600, style: "normal" });
  if (displayItalic) fonts.push({ name: "Display", data: displayItalic, weight: 600, style: "italic" });
  if (body) fonts.push({ name: "Body", data: body, weight: 500, style: "normal" });
  if (bodyBold) fonts.push({ name: "Body", data: bodyBold, weight: 700, style: "normal" });
  return fonts;
}

/** The photo as a data URL (JPEG — Satori can't decode AVIF/WebP), or null. */
async function loadPhoto(content: SiteContent): Promise<string | null> {
  const media = resolveMedia(content, content.settings.seo.ogImageMediaId) ?? portraitOf(content);
  if (!media || media.resourceType !== "image" || isLocalPublicId(media.publicId)) return null;
  const src = imageUrl(media, { width: 760, height: 1000, crop: "fill", gravity: "face" }).replace("f_auto", "f_jpg");
  if (!src.startsWith("http")) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

const jaali = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><pattern id="j" width="48" height="48" patternUnits="userSpaceOnUse"><g fill="none" stroke="${palette.ink}" stroke-width="1"><path d="M24 2 46 24 24 46 2 24Z"/><circle cx="24" cy="24" r="7"/><path d="M0 0 8 8M48 0 40 8M0 48 8 40M48 48 40 40"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#j)"/></svg>`,
)}`;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Card({ content, photo }: { content: SiteContent; photo: string | null }): ReactElement {
  const { identity } = content.settings;
  const words = (identity.name || "Creator").trim().split(/\s+/);
  const first = words.slice(0, -1).join(" ") || words[0];
  const last = words.length > 1 ? words[words.length - 1] : "";
  const city = identity.location.split(",")[0]?.trim();
  const eyebrow = [identity.role, city].filter(Boolean).join(" · ").toUpperCase();
  const brands = content.brands
    .filter((b) => b.featured)
    .slice(0, 4)
    .map((b) => b.name);
  const nameSize = identity.name.length > 18 ? 84 : 104;
  const tagline = identity.tagline.length > 110 ? `${identity.tagline.slice(0, 107)}…` : identity.tagline;

  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", background: palette.cream, fontFamily: "Body", color: palette.ink }}>
      {/* faint jaali lattice + a soft blush glow behind the photo */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
      <img src={jaali} width={W} height={H} alt="" style={{ position: "absolute", left: 0, top: 0, opacity: 0.07 }} />
      <div
        style={{
          position: "absolute",
          left: -120,
          top: -140,
          width: 720,
          height: 720,
          borderRadius: 720,
          background: `radial-gradient(circle, ${palette.blush} 0%, rgba(240,210,201,0) 70%)`,
        }}
      />

      {/* left: photo in the arch */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 470, height: H, paddingLeft: 40 }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 372,
            height: 500,
            padding: 10,
            borderRadius: "186px 186px 20px 20px",
            border: `2px solid ${palette.roseDeep}`,
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: "176px 176px 12px 12px",
              background: palette.cream2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
              <img src={photo} width={352} height={480} alt="" style={{ width: 352, height: 480, objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", fontFamily: "Display", fontSize: 160, color: palette.roseDeep }}>{initialsOf(identity.name)}</div>
            )}
          </div>
          {city ? (
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: -16,
                left: 106,
                padding: "6px 18px",
                background: palette.rose,
                color: palette.ink,
                fontSize: 20,
                fontWeight: 700,
                transform: "rotate(-3deg)",
              }}
            >
              {identity.location}
            </div>
          ) : null}
        </div>
      </div>

      {/* right: who she is */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, paddingLeft: 40, paddingRight: 72 }}>
        {eyebrow ? <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 4, color: palette.roseDeep }}>{eyebrow}</div> : null}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", marginTop: 14, fontFamily: "Display", fontSize: nameSize, lineHeight: 1.02, letterSpacing: -1.5 }}>
          <span style={{ color: palette.ink, fontStyle: "normal", marginRight: 22 }}>{first}</span>
          {last ? <span style={{ color: palette.roseDeep, fontStyle: "italic" }}>{last}</span> : null}
        </div>
        {tagline ? <div style={{ display: "flex", marginTop: 22, fontSize: 28, lineHeight: 1.35, color: palette.inkSoft, maxWidth: 600 }}>{tagline}</div> : null}
        <div style={{ display: "flex", width: 72, height: 3, marginTop: 30, background: palette.gold }} />
        {brands.length ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
            <div style={{ display: "flex", fontSize: 18, fontWeight: 700, letterSpacing: 3, color: palette.inkSoft }}>WORKED WITH</div>
            <div style={{ display: "flex", marginTop: 8, fontFamily: "Display", fontSize: 30, color: palette.ink }}>{brands.join("  ·  ")}</div>
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", marginTop: 34 }}>
          {identity.handle ? (
            <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: palette.roseDeep, color: palette.cream, fontSize: 22, fontWeight: 700 }}>
              @{identity.handle}
            </div>
          ) : null}
        </div>
      </div>

      {/* monogram, bottom right */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 44,
          bottom: 40,
          width: 64,
          height: 64,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          background: palette.roseDeep,
          color: palette.cream,
          fontFamily: "Display",
          fontSize: 34,
        }}
      >
        <span style={{ fontStyle: "normal" }}>{initialsOf(identity.name).charAt(0)}</span>
        <span style={{ fontStyle: "italic" }}>{initialsOf(identity.name).charAt(1)}</span>
      </div>
    </div>
  );
}

export async function renderShareCard(content: SiteContent): Promise<ShareCard> {
  const [fonts, photo] = await Promise.all([loadFonts(), loadPhoto(content)]);
  return { element: <Card content={content} photo={photo} />, fonts, size: { width: W, height: H } };
}
