import type { CreatorPackage } from "@/creators/types";
import { brands, collections, media, settings, settingsMedia, testimonials } from "./content";
import { DEVANSHI_ID } from "./id";

/**
 * Devanshi Jain — UGC creator, Jaipur.
 * Sources: her Canva portfolio (stratusloc.my.canva.site/devanshi-jain), her
 * Instagram bio (@devanshyyii, Nov 2026) and the files in /data.
 */
const devanshi: CreatorPackage = {
  id: DEVANSHI_ID,
  settings,
  settingsMedia,
  collections,
  brands,
  testimonials,
  media,
  admin: {
    loginConsent: {
      label:
        "I agree and accept that I LIKE Aditya Gangwani (ADDI) from the bottom of my heart, and I can't live a single day without remembering him at least 10 times a day 💘",
      error: "Sorry, you need to like him. Otherwise fuck off from here 😤",
    },
    counter: {
      key: "likes-addi",
      label: "times Devanshi agreed she likes ADDI",
      perLogin: 10,
      perView: 1,
    },
  },
};

export default devanshi;
