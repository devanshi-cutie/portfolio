import { ArrowUpRight, AtSign, Mail, MessageCircle, Phone } from "lucide-react";
import type { SectionConfig, SiteContent } from "@/core/types/content";
import { ContactForm } from "../components/ContactForm";
import { Arrow } from "../components/Doodles";
import { PatrikaGate } from "../components/jaipur/PatrikaGate";
import { SectionHeading } from "../components/SectionHeading";
import { instagramUrl } from "../lib/media";
import { Reveal } from "../motion/Reveal";

export function Contact({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const { contact, identity } = content.settings;
  const ig = instagramUrl(content);
  const wa = contact.whatsapp.replace(/\D/g, "");
  const channels = [
    contact.email && { href: `mailto:${contact.email}`, label: contact.email, Icon: Mail, external: false },
    wa && { href: `https://wa.me/${wa}`, label: "WhatsApp", Icon: MessageCircle, external: true },
    contact.phone && { href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`, label: contact.phone, Icon: Phone, external: false },
    { href: ig, label: `DM @${identity.handle}`, Icon: AtSign, external: true },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Mail; external: boolean }[];

  return (
    <section id="contact" aria-labelledby="contact-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto grid max-w-[1320px] gap-10 md:gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="min-w-0">
          <SectionHeading id="contact-title" section={section} eyebrow size="md" />
          <Reveal delay={0.05}>
            <ul className="mt-10 flex flex-col gap-3">
              {channels.map(({ href, label, Icon, external }) => (
                <li key={href}>
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="group inline-flex min-h-12 min-w-0 max-w-full items-center gap-3 text-lg font-semibold"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-(--ink) transition-[background-color,color] duration-150 group-hover:bg-(--ink) group-hover:text-(--cream)">
                      <Icon className="size-[1.1rem]" aria-hidden />
                    </span>
                    <span className="min-w-0 [overflow-wrap:anywhere] underline decoration-(--rose) decoration-2 underline-offset-[6px] transition-colors duration-150 group-hover:decoration-(--rose-deep)">
                      {label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {contact.mediaKitUrl ? (
              <a
                href={contact.mediaKitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-(--rose-deep) hover:underline hover:underline-offset-4"
              >
                Media kit
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            ) : null}
            <Arrow className="mt-10 hidden size-20 -rotate-[30deg] text-(--rose-deep) lg:block" />
          </Reveal>
        </div>

        {/* the letter stands in front of Patrika Gate: the painted arches rise above the card.
            The top padding is the share of the gate left showing (gate width × 1.5 × 0.4). */}
        <div className="relative min-w-0 pt-[min(43.2%,15.75rem)] lg:-mt-12">
          <PatrikaGate className="absolute left-1/2 top-0 w-[72%] max-w-[26.25rem] -translate-x-1/2" />
          <Reveal className="relative drop-shadow-[0_24px_30px_rgb(44_17_25/0.16)]">
            <span aria-hidden className="sb-tape absolute -top-3 right-10 z-[1] block h-6 w-28 rotate-[5deg]" />
            <ContactForm instagram={ig} name={identity.name} budgetOptions={contact.budgetOptions ?? []} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
