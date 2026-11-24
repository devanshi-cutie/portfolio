import { ImageResponse } from "next/og";
import { getSiteContent } from "@/core/data/site";
import { renderShareCard } from "@/themes/active-share";

/** Social preview card, designed by the active theme from live site content. */
export const alt = "Portfolio preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const content = await getSiteContent();
  const card = await renderShareCard(content);
  return new ImageResponse(card.element, { ...card.size, fonts: card.fonts });
}
