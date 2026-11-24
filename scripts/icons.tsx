/**
 * Generates the site's monogram icons into src/app/ (committed to the repo,
 * not Cloudinary):
 *   icon.png        192px, letters only — browser tabs
 *   apple-icon.png  180px, letters inside an arch — iPhone home screen
 *   favicon.ico     32 + 48px, letters only — legacy browsers
 *
 * Initials come from the active creator's name ("Devanshi Jain" → "DJ"); the
 * first letter is upright and the second italic, like the site's name lockup.
 *
 *   npm run icons
 *   npm run icons -- --initials=DJ --bg=#9C4A5C --bg2=#7E3647 --fg=#F7ECE2 --accent=#C39A55 --font=Fraunces
 *
 * Needs network once to fetch the two glyphs from Google Fonts.
 */
import fs from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";
import creator from "@/creators/active";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...v] = a.slice(2).split("=");
      return [k, v.join("=")];
    }),
);

const initials = (args.initials || creator.settings.identity.name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2)).toUpperCase();
// Defaults: the scrapbook theme's Pink City palette (src/themes/scrapbook/palette.ts).
const C = {
  bg: args.bg || "#9C4A5C",
  bg2: args.bg2 || "#7E3647",
  fg: args.fg || "#F7ECE2",
  accent: args.accent || "#C39A55",
};
const family = args.font || "Fraunces";
const outDir = path.join(process.cwd(), "src/app");

async function loadFont(italic: boolean): Promise<ArrayBuffer> {
  const q = `family=${encodeURIComponent(family)}:ital,wght@${italic ? 1 : 0},600&text=${encodeURIComponent(initials)}`;
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${q}`, { headers: { "User-Agent": "Mozilla/4.0" } })).text();
  const url = css.match(/url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error(`Could not load ${family}${italic ? " italic" : ""} from Google Fonts`);
  return (await fetch(url)).arrayBuffer();
}

type Variant = "letters" | "arch";

function Logo({ size, variant, rounded }: { size: number; variant: Variant; rounded: boolean }) {
  const s = size / 512;
  const px = (n: number) => Math.round(n * s);
  const line = Math.max(2, px(10));
  const [first, second = ""] = initials.split("");
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: `linear-gradient(160deg, ${C.bg} 0%, ${C.bg2} 100%)`,
        borderRadius: rounded ? px(112) : 0,
      },
    },
    variant === "arch"
      ? h("div", {
          style: {
            position: "absolute",
            left: px(92),
            right: px(92),
            top: px(64),
            bottom: px(70),
            border: `${line}px solid ${C.accent}`,
            borderBottomWidth: 0,
            borderRadius: `${px(170)}px ${px(170)}px 0 0`,
          },
        })
      : null,
    variant === "arch"
      ? h("div", { style: { position: "absolute", left: px(80), right: px(80), bottom: px(70), height: line, background: C.accent } })
      : null,
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "baseline",
          color: C.fg,
          fontFamily: family,
          fontSize: px(variant === "arch" ? 232 : 330),
          lineHeight: 1,
          letterSpacing: px(-12),
          marginTop: px(variant === "arch" ? -6 : -10),
          paddingRight: px(variant === "arch" ? 10 : 0),
        },
      },
      h("span", { style: { fontStyle: "normal", fontWeight: 600 } }, first),
      second ? h("span", { style: { fontStyle: "italic", fontWeight: 600, marginLeft: px(-6) } }, second) : null,
    ),
  );
}

async function png(size: number, variant: Variant, rounded: boolean, fonts: NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]) {
  const res = new ImageResponse(h(Logo, { size, variant, rounded }), { width: size, height: size, fonts });
  return Buffer.from(await res.arrayBuffer());
}

/** ICO container with embedded PNGs (supported by every current browser). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const dirs = images.map(({ size, data }) => {
    const d = Buffer.alloc(16);
    d[0] = size;
    d[1] = size;
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(data.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += data.length;
    return d;
  });
  return Buffer.concat([head, ...dirs, ...images.map((i) => i.data)]);
}

async function main() {
  const fonts = [
    { name: family, data: await loadFont(false), style: "normal" as const, weight: 600 as const },
    { name: family, data: await loadFont(true), style: "italic" as const, weight: 600 as const },
  ];
  fs.writeFileSync(path.join(outDir, "icon.png"), await png(192, "letters", true, fonts));
  fs.writeFileSync(path.join(outDir, "apple-icon.png"), await png(180, "arch", false, fonts));
  fs.writeFileSync(
    path.join(outDir, "favicon.ico"),
    ico([
      { size: 32, data: await png(32, "letters", true, fonts) },
      { size: 48, data: await png(48, "letters", true, fonts) },
    ]),
  );
  console.log(`Wrote "${initials}" icons to src/app/ (icon.png, apple-icon.png, favicon.ico)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
