# Theme: `scrapbook` (Devanshi Jain)

Design brief for the first theme. Derived from her own Canva portfolio (butter-yellow pages, burgundy display type, script lettering, film strips, stamp-edged cards, a tripod illustration, lace frame on the "Thank you" page, a denim texture) and her Instagram voice ("Minimal • Fashion • Lifestyle 🌻 — anything that's purely heartfelt"; "basically born a yapper").

**One-line direction:** an editorial scrapbook — a fashion magazine someone has lovingly annotated. Warm paper, confident burgundy type, playful cut-out details, and the reels always front and centre. Polished enough for Amazon Fashion, personal enough for a Jaipur boutique.

## Palette (CSS variables in the theme, overridable from `settings.theme`)
- paper `#FFF6D6` (butter cream, page background) · paper-deep `#FBE9A8` (bands, stamps)
- ink `#1E1414` (body text) · burgundy `#7A1B22` (display type, primary) · burgundy-deep `#561016`
- blush `#F6C6CF` (stamp borders, highlights) · denim `#3F5D8C` (one accent: links/active chip, sparingly)
- Keep contrast AA on paper. One "Von Restorff" element per view — the primary CTA in burgundy.

## Type (next/font/google, loaded inside the theme)
- Display: a high-contrast condensed serif for big caps headlines (e.g. "Bodoni Moda" / "Gloock" / "DM Serif Display" — pick what renders best condensed and uppercase).
- Script: an elegant calligraphic script for accents only — her name, "Some of my", "Thank you" (e.g. "Pinyon Script" or "Italianno"). Never for body or long text.
- Body/UI: a clean grotesk ("Instrument Sans" or "DM Sans"). Bold weight for brand lists (the Canva used a heavy geometric sans there).

## Signature pieces
- **Phone-frame reel cards** (rounded device frame, IG-like bottom bar hint) — the core work unit. Poster image by default; muted autoplay when hovered (desktop) or when centred in view (mobile); click opens a lightbox.
- **Stamp-edged cards** (perforated edge via CSS mask/radial-gradient) for highlights and stats.
- **Film strip** frames for BTS clips and the process timeline.
- **Polaroids** with slight random rotation for BTS photos; draggable/stack interaction on desktop.
- **Script + condensed caps lockups** for section headings ("Some of my / FAVOURITE WORK").
- Small hand-drawn-feeling SVG doodles (star, heart, underline swash, arrow) used sparingly. No stock illustrations, no emoji soup.
- Subtle paper grain overlay (CSS/SVG noise, very low opacity).

## Sections (render in `content.sections` order; skip unknown keys)
1. **hero** — script name over condensed "UGC CREATOR", tagline, rotating `identity.keywords`, CTAs (primary: contact; secondary: Instagram). A fan/stack of 3 featured reels in phone frames (hero media first), slightly rotated, gentle parallax on pointer. Availability pill.
2. **brands marquee** directly under the hero — scroll-velocity marquee of brand names (logos when present), featured brands larger.
3. **work** — collection filter chips (All + each collection that has items) with animated active pill; grid of phone-frame cards (masonry-ish on desktop, 2-col on mobile); each card shows title, brand, collection. Lightbox: full video with sound, prev/next, keyboard (←/→/Esc), swipe on mobile, grows from the clicked card, closes fast. Link to `/work/[slug]` per collection.
4. **brands** — the full wall: two groups by tag ("UGC content creation", "Instagram collabs"), featured brands emphasised.
5. **about** — portrait (polaroid/arch), short + long bio, location, socials.
6. **highlights** — "Why work with me?" stamp cards, staggered in.
7. **stats** — count-up numbers in stamps (non-numeric values like "3-in-1" just fade in).
8. **process** — film-strip timeline of `settings.process`.
9. **bts** — polaroids (photos) + film-strip BTS clips.
10. **services** — cards with deliverable lists.
11. **testimonials** — paper notes / torn-edge cards, carousel or stacked; quotes are long, keep them readable.
12. **contact** — form (name, email, company, budget, message; honeypot `website`) wired to `submitInquiry` with `useActionState`, inline errors, a real success moment (peak-end); plus email / WhatsApp / Instagram buttons when set (hide empty ones). Footer: lace-like frame, script "Thank you", @handle.

Nav: minimal sticky bar (name lockup left, anchors, "Work with me" button), compresses on scroll, full-screen mobile menu that grows from the burger.

## Motion (ReactBits-inspired, built with `motion` / `gsap` already installed)
Good fits: SplitText/BlurText reveal for headings, RotatingText for keywords, ScrollVelocity marquee for brands, CountUp for stats, TiltedCard / Magnet for reel cards and CTAs, Stack / drag for polaroids, CircularText badge ("UGC CREATOR • JAIPUR •"), ClickSpark-like burst on form success. Follow the motion rules in ARCHITECTURE.md exactly; `prefers-reduced-motion` turns movement into fades.

## Performance
Posters first, `preload="none"` on grid videos, play only when visible, one playing grid video at a time, Cloudinary widths sized to the card (≈ 480–720px), lazy sections below the fold. Hero LCP is text + one poster image. No layout shift from late fonts (`display: swap` + fallbacks sized).
