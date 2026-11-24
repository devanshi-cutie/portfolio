import type {
  BrandSeed,
  CollectionSeed,
  CreatorPackage,
  MediaSeed,
  TestimonialSeed,
} from "@/creators/types";
import type { SiteSettings } from "@/core/types/content";

/* ------------------------------------------------------------- settings */

export const settings: SiteSettings = {
  identity: {
    name: "Devanshi Jain",
    handle: "devanshyyii",
    role: "UGC Creator",
    location: "Jaipur, Rajasthan",
    tagline: "Raw, real content that makes people stop scrolling — and start buying.",
    shortBio:
      "I love creating content because creativity genuinely attracts me. Public speaking isn't just a passion — it's the love of my life (I was basically born a yapper).",
    longBio:
      "I'm a full-time UGC creator from Jaipur with a commerce background, so I don't just make pretty videos — I make content built to help your brand grow and reach the right people. I handle the whole lifecycle myself, from the first script to the final edit, and I switch easily between high-end aesthetics and the raw-and-real style that builds trust. 40+ brands later, from Amazon Fashion and Myntra FWD to Jaipur's own labels, most of them come back for more.",
    portraitMediaId: null,
    heroMediaId: null,
    keywords: ["Fashion", "Lifestyle", "Jewellery", "Real estate", "Food", "Travel", "Tech"],
  },
  contact: {
    email: "",
    phone: "",
    whatsapp: "",
    ctaLabel: "Let's create together",
    availability: "Open for UGC & Instagram collaborations",
    mediaKitUrl: "https://stratusloc.my.canva.site/devanshi-jain",
    budgetOptions: ["Under ₹10k", "₹10k to ₹25k", "₹25k to ₹50k", "₹50k+", "Not sure yet"],
  },
  socials: [
    { platform: "instagram", label: "Instagram", url: "https://www.instagram.com/devanshyyii/" },
    { platform: "website", label: "Canva portfolio", url: "https://stratusloc.my.canva.site/devanshi-jain" },
  ],
  brandGroups: [
    { tag: "ugc", label: "UGC content creation" },
    { tag: "instagram", label: "Instagram collabs" },
  ],
  stats: [
    { value: "40+", label: "Brands collaborated with" },
    { value: "2.6K", label: "Instagram community" },
    { value: "8+", label: "Industries covered" },
    { value: "3-in-1", label: "Scriptwriter, creator & editor" },
  ],
  highlights: [
    {
      title: "Creative & strategic",
      body: "With my commerce background, I don't just make pretty videos — I create content designed to help your brand grow and reach the right people.",
    },
    {
      title: "Full production support",
      body: "I handle the entire process — brainstorming, scripting, filming and final editing — saving you time and effort.",
    },
    {
      title: "Versatile talent",
      body: "Whether you need a confident face for your brand or a behind-the-scenes content strategist, I adapt my tone and energy to match your vibe.",
    },
    {
      title: "Proven experience",
      body: "I've partnered with 40+ brands, like Amazon Fashion and Myntra FWD, and have a high repeat-client rate because I deliver quality every time.",
    },
    {
      title: "Real & relatable",
      body: "I specialise in the raw-and-real aesthetic that builds deep trust and strong connections with your audience.",
    },
    {
      title: "High energy & reliable",
      body: "Presence of mind and an extroverted nature mean I'm professional, easy to work with and always ready to bring big ideas to life.",
    },
  ],
  services: [
    {
      title: "UGC videos",
      description: "Brand-owned videos for your ads, website and socials — you get the raw files and the edit.",
      deliverables: ["Concept & script", "Vertical 9:16 edit", "Hooks & variations", "Raw footage on request"],
    },
    {
      title: "Instagram collaborations",
      description: "Collab reels posted with my audience, written in my voice so they feel native to the feed.",
      deliverables: ["Collab reel", "Story mentions", "Caption & hashtags"],
    },
    {
      title: "Scripting & strategy",
      description: "Hooks, scripts and shot lists tailored to your goal, niche and audience.",
      deliverables: ["Hook bank", "Scripts", "Shot list", "Styling & dress-code notes"],
    },
  ],
  process: [
    { title: "Brief", body: "We talk goals, audience and the vibe you want. I study the brand before I touch a camera." },
    { title: "Script", body: "Hooks, script and shot list, customised to the goal — you approve before we shoot." },
    { title: "Shoot", body: "On location or in-store, with the right styling and energy for your niche." },
    { title: "Edit & deliver", body: "Fast, trend-aware edits delivered on time, with a round of revisions included." },
  ],
  sections: [
    { key: "hero", enabled: true, eyebrow: "UGC Creator · Jaipur", title: "Devanshi Jain", subtitle: "" },
    { key: "work", enabled: true, eyebrow: "Selected work", title: "Some of my favourite work", subtitle: "Reels made for brands across fashion, jewellery, real estate, food, travel and tech." },
    { key: "brands", enabled: true, eyebrow: "Collaborations", title: "40+ brands, one voice", subtitle: "UGC and Instagram collaborations with labels big and small." },
    { key: "about", enabled: true, eyebrow: "About", title: "A camera-friendly extrovert", subtitle: "" },
    { key: "highlights", enabled: true, eyebrow: "Why work with me", title: "Why brands come back", subtitle: "" },
    { key: "stats", enabled: true, eyebrow: "In numbers", title: "The short version", subtitle: "" },
    { key: "process", enabled: true, eyebrow: "How it works", title: "From first script to final edit", subtitle: "" },
    { key: "bts", enabled: true, eyebrow: "Behind the scenes", title: "BTS", subtitle: "Tripods, takes and a lot of talking." },
    { key: "services", enabled: true, eyebrow: "Services", title: "What I can make for you", subtitle: "" },
    { key: "testimonials", enabled: true, eyebrow: "Client feedback", title: "What brands say", subtitle: "" },
    { key: "contact", enabled: true, eyebrow: "Contact", title: "Let's create something worth watching", subtitle: "Tell me about your brand and what you need — I'll get back within a day." },
  ],
  seo: {
    title: "Devanshi Jain — UGC Creator in Jaipur",
    description:
      "Devanshi Jain is a full-time UGC creator from Jaipur. Scripted, shot and edited reels for 40+ brands across fashion, jewellery, real estate, food, travel and tech.",
    ogImageMediaId: null,
  },
  theme: {},
};

export const settingsMedia: CreatorPackage["settingsMedia"] = {
  portraitSource: "portrait-devanshi.jpg",
  heroSource: "Outdoor city shoot/1762495003611255.mp4",
};

/* ---------------------------------------------------------- collections */

export const collections: CollectionSeed[] = [
  { slug: "fashion", title: "Fashion & ethnic wear", description: "Clothing labels and stores — try-ons, launches and styling.", coverSource: "Nishorama .mp4" },
  { slug: "jewellery", title: "Jewellery", description: "Close-ups, styling and storytelling for jewellery brands.", coverSource: "Jewellery/1787036630047575.mp4" },
  { slug: "real-estate", title: "Real estate & stays", description: "Walkthroughs and lifestyle reels for homes, projects and stays.", coverSource: "Real estate/PinkWall_Reel_V4_01.mp4" },
  { slug: "food", title: "Food & cafés", description: "Cafés and food brands, shot to make you hungry.", coverSource: "The 202 Café.mp4" },
  { slug: "tech", title: "Tech & apps", description: "Explainers and relatable skits for tech products.", coverSource: "Phylaxis AI/42698d4c6ecf45f593a50bba944cb3eb.mp4" },
  { slug: "travel", title: "Travel", description: "Places, stays and the feeling of being there.", coverSource: "Travel/IMG_9244.mp4" },
  { slug: "lifestyle", title: "Lifestyle & city", description: "Everyday moments and outdoor city shoots.", coverSource: "Outdoor city shoot/1762495003611255.mp4" },
  { slug: "create-n-beyond", title: "Create n Beyond (agency)", description: "Reels made with the Create n Beyond agency.", coverSource: "Create n beyond agency/1788348586549019.mp4" },
  { slug: "behind-the-scenes", title: "Behind the scenes", description: "How the reels actually get made.", coverSource: "IMG_3603.JPG.jpeg" },
];

/* --------------------------------------------------------------- brands */

const ugc = (name: string, extra: Partial<BrandSeed> = {}): BrandSeed => ({ name, tags: ["ugc"], ...extra });
const ig = (name: string, extra: Partial<BrandSeed> = {}): BrandSeed => ({ name, tags: ["instagram"], ...extra });
const both = (name: string, extra: Partial<BrandSeed> = {}): BrandSeed => ({ name, tags: ["ugc", "instagram"], ...extra });

/** From the "UGC content creation" and "Instagram collab" lists in her Canva portfolio, plus brands in /data. */
export const brands: BrandSeed[] = [
  // featured first
  ig("Amazon Fashion", { featured: true }),
  ig("Myntra FWD", { featured: true }),
  ig("Flipkart Spoyl", { featured: true }),
  both("Saadaa", { featured: true }),
  ig("Campus", { featured: true }),
  ig("Zouk", { featured: true }),
  ig("Newme Store", { featured: true }),
  ugc("Phylaxis", { featured: true }),
  // UGC content creation
  ugc("Shuddhi"),
  ugc("Ghaavi"),
  ugc("Pink Wall"),
  ugc("Aashish Group"),
  ugc("Black Olive Farm"),
  ugc("Urban Vahan"),
  ugc("Kore Designs & Builds"),
  both("Gulabi Trend"),
  ugc("Amaayu"),
  ugc("Mizoya"),
  ugc("Sweetnest"),
  ugc("Leads Mile"),
  ugc("Travel Venture"),
  ugc("Non Local"),
  ugc("Jaipur Basta"),
  ugc("Gulnaar by Navya"),
  both("Baaori"),
  ugc("Keeraz"),
  // Instagram collabs
  ig("Leher Vastra"),
  ig("Good Hand Jaipur"),
  ig("Pearl & Polish Nail Studio"),
  ig("Deebaco Official"),
  ig("Decked Up"),
  ig("Amrita Naturals"),
  ig("Kridha"),
  ig("Dori Jaipur"),
  ig("Label Maya"),
  ig("Athkheli Jaipur"),
  ig("The Wristlet Store"),
  ig("Lussuro"),
  ig("Kalai Studio"),
  ig("Mg Beauty"),
  ig("Haute Pink Global"),
  ig("Pepperfy Tonkroad"),
  ig("Meraci"),
  ig("Outzidr"),
  // from /data
  ugc("The 202 Café"),
  ugc("Nishorama"),
  ugc("Create n Beyond", { slug: "create-n-beyond" }),
];

/* --------------------------------------------------------- testimonials */

/** From the "Client feedback" page of her Canva portfolio. Brand names were not shown there. */
export const testimonials: TestimonialSeed[] = [
  {
    quote:
      "Working with Devanshi was a smooth and positive experience. She was professional, receptive to feedback, and understood the brand's vision very well. The communication was easy, timelines were respected, and the final output matched our expectations perfectly. Would definitely love to collaborate again.",
    authorRole: "Brand partner",
  },
  {
    quote:
      "You are working amazingly in comparison to many out there who do it without passion. The kind of approach you take on different brands and niches is pretty brand-strategist coded — you customise your scripts to the goal, the editing style, even relevant dress codes, while emphasising the goal of the content. A good balanced creator, I would say.",
    authorRole: "Brand partner",
  },
  {
    quote:
      "You are pretty confident on camera and honestly, I've seen UGC creators being a little hard to work with because they have a very specific, unapproachable way of working. What I like about your work is that you understand the brand more than just a creator, and then own the scripts your way — that makes the content feel more original and authentic.",
    authorRole: "Brand partner",
  },
  {
    quote:
      "Devanshi comes across as very confident and natural on camera. Her friendliness feels genuine, not forced, which makes the content instantly relatable. She expresses emotions clearly and effortlessly, making the videos engaging and easy to connect with — exactly what UGC content needs to build trust.",
    authorRole: "Brand partner",
  },
];

/* ---------------------------------------------------------------- media */

/**
 * Every file in /data. Collection and brand assignments are a first pass from
 * folder and file names — they are all editable in the admin panel.
 */
export const media: MediaSeed[] = [
  // Fashion
  { source: "Nishorama .mp4", kind: "reel", title: "Piku's style, reimagined for Gen Z", collection: "fashion", brand: "nishorama", featured: true },
  { source: "Ghaavi.mp4", kind: "reel", title: "Ghaavi in-store reel", collection: "fashion", brand: "ghaavi", featured: true },
  { source: "Shuddhi.mp4", kind: "reel", title: "Arey aao, madam! — Shuddhi", collection: "fashion", brand: "shuddhi", featured: true },
  { source: "Saadaa clothing/Aaj ki taaza khabar kuch khaas hai ✨📢...#newlaunch #rahosaadaa #pehnosaadaa.mp4", kind: "reel", title: "Aaj ki taaza khabar — Saadaa new launch", collection: "fashion", brand: "saadaa", featured: true },
  { source: "Saadaa clothing/a55edeb9-e8fd-4141-819e-3ba9ef17c756.mp4", kind: "reel", title: "Saadaa styling reel", collection: "fashion", brand: "saadaa" },

  // Jewellery
  { source: "Jewellery/1787036630047575.mp4", kind: "reel", title: "Jewellery styling reel", collection: "jewellery", featured: true },
  { source: "Jewellery/Copy of IMG_0007.MP4", kind: "reel", title: "Jewellery try-on", collection: "jewellery" },
  { source: "Jewellery/Copy of IMG_9991.MP4", kind: "reel", title: "Jewellery close-ups", collection: "jewellery" },

  // Real estate
  { source: "Real estate/PinkWall_Reel_V4_01.mp4", kind: "reel", title: "Pink Wall walkthrough", collection: "real-estate", brand: "pink-wall", featured: true },
  { source: "Real estate/Copy of PARK ORNATE.mp4", kind: "reel", title: "Park Ornate", collection: "real-estate" },
  { source: "Real estate/AirBnB_1_v2.mp4", kind: "reel", title: "Airbnb stay tour", collection: "real-estate" },

  // Food & cafés
  { source: "The 202 Café.mp4", kind: "reel", title: "The 202 Café", collection: "food", brand: "the-202-cafe", featured: true },
  { source: "Jaipur Basta.mp4", kind: "reel", title: "Jaipur Basta", collection: "lifestyle", brand: "jaipur-basta" },

  // Tech
  { source: "Phylaxis AI/42698d4c6ecf45f593a50bba944cb3eb.mp4", kind: "reel", title: "Phylaxis AI explainer", collection: "tech", brand: "phylaxis", featured: true },
  { source: "Phylaxis AI/52e8cf2400a14e509b61ba799f9ecdad.mp4", kind: "reel", title: "Phylaxis AI skit", collection: "tech", brand: "phylaxis" },
  { source: "Phylaxis AI/ea0288dbd5de4179ae3fcc3e27471d8f.mp4", kind: "reel", title: "Phylaxis AI — everyday use", collection: "tech", brand: "phylaxis" },
  { source: "Phylaxis AI/Video-912.mp4", kind: "reel", title: "Phylaxis AI short", collection: "tech", brand: "phylaxis" },

  // Travel
  { source: "Travel/IMG_9244.mp4", kind: "reel", title: "Travel diary", collection: "travel", featured: true },
  { source: "Travel/IMG_9364.mp4", kind: "reel", title: "On the road", collection: "travel" },
  { source: "Travel/lv_0_20260128041324.mp4", kind: "reel", title: "Travel edit", collection: "travel" },

  // Lifestyle & city
  { source: "Outdoor city shoot/1762495003611255.mp4", kind: "reel", title: "Outdoor city shoot", collection: "lifestyle", featured: true },
  { source: "Outdoor city shoot/1770629860866803.mp4", kind: "reel", title: "City streets", collection: "lifestyle" },
  { source: "ae2b84017c784b90a796691d7b234743.mp4", kind: "reel", title: "Talking-head reel", collection: "lifestyle" },

  // Agency
  { source: "Create n beyond agency/1788348586549019.mp4", kind: "reel", title: "Create n Beyond reel 1", collection: "create-n-beyond", brand: "create-n-beyond" },
  { source: "Create n beyond agency/1788350508039385.mp4", kind: "reel", title: "Create n Beyond reel 2", collection: "create-n-beyond", brand: "create-n-beyond" },
  { source: "Create n beyond agency/1788357856833498.mp4", kind: "reel", title: "Create n Beyond reel 3", collection: "create-n-beyond", brand: "create-n-beyond" },

  // Portrait (a still from her outdoor city shoot; used for the about section and the admin login — not shown in BTS)
  { source: "portrait-devanshi.jpg", kind: "portrait", title: "Devanshi Jain", alt: "Devanshi Jain smiling beside a flower stall in a floral top" },

  // Behind the scenes
  { source: "IMG_3603.JPG.jpeg", kind: "bts", title: "On set — bedroom shoot", alt: "Devanshi seated on a bed while a cameraman films her on a set with studio lights", collection: "behind-the-scenes" },
  { source: "IMG_3606.JPG.jpeg", kind: "bts", title: "Between takes", alt: "Devanshi on a bed set, camera and light stand in the foreground", collection: "behind-the-scenes" },
  { source: "IMG_5777.JPG.jpeg", kind: "bts", title: "Street shoot in Jaipur", alt: "Devanshi in a pink dress holding a microphone, filmed by a videographer on a Jaipur street", collection: "behind-the-scenes" },
  { source: "IMG_5789.JPG.jpeg", kind: "bts", title: "Phone on a tripod", alt: "A phone on a tripod recording Devanshi in a bright room", collection: "behind-the-scenes" },
  { source: "IMG_8119.PNG", kind: "bts", title: "Camera check", alt: "A camera on a tripod showing Devanshi on its screen", collection: "behind-the-scenes" },
  { source: "IMG_3529.MOV", kind: "bts", title: "BTS — games room shoot", collection: "behind-the-scenes" },
  { source: "IMG_3532.MOV", kind: "bts", title: "BTS — outdoor take", collection: "behind-the-scenes" },
  { source: "IMG_6470.MOV", kind: "bts", title: "BTS — warehouse shoot", collection: "behind-the-scenes" },
  { source: "IMG_7087.MOV", kind: "bts", title: "BTS — studio setup", collection: "behind-the-scenes" },
  { source: "IMG_9291.MP4", kind: "bts", title: "BTS — rooftop take", collection: "behind-the-scenes" },
];
