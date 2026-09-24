import type { PageSection } from "@/lib/page-sections";
import type { PublicPageKey } from "@/lib/public-pages";

/**
 * Default section content for every public page.
 *
 * This is the source of truth used to seed `content_entries` so each public
 * page becomes editable from the admin page builder and inline on the page
 * itself. Pages that need live data (the contact form, the published FAQ list)
 * use the `contactForm`, `faqList` and `therapistList` sections, which keep
 * pulling from the database instead of freezing a copy of it.
 */

export type PublicPageSeed = {
  title: string;
  excerptHtml: string;
  sections: PageSection[];
};

type Base = {
  hidden: false;
  surface: PageSection["surface"];
  spacing: PageSection["spacing"];
  width: PageSection["width"];
  align: PageSection["align"];
};

const base = (over: Partial<Base> = {}): Base => ({
  hidden: false,
  surface: "page",
  spacing: "md",
  width: "content",
  align: "left",
  ...over,
});

const card = (
  id: string,
  title: string,
  tagline: string,
  body: string,
  bullets: string[] = [],
  image: { src: string; alt: string } = { src: "", alt: "" },
  href = "",
  linkLabel = "",
  tone: "default" | "dark" = "default",
) => ({ id, title, tagline, body, bullets, image, href, linkLabel, tone });

const prose = (id: string, heading: string, paragraphs: string[]): PageSection => ({
  ...base({ width: "narrow" }),
  id,
  type: "richText",
  heading,
  html: paragraphs.map((p) => `<p>${p}</p>`).join("\n"),
});

const bookCta = (id: string, heading: string, body: string): PageSection => ({
  ...base({ surface: "cream", align: "center", spacing: "lg" }),
  id,
  type: "cta",
  eyebrow: "",
  heading,
  body,
  links: [
    { id: `${id}-book`, label: "Book a session", href: "/book", variant: "primary" as const },
    {
      id: `${id}-contact`,
      label: "Talk to us first",
      href: "/contact",
      variant: "outline" as const,
    },
  ],
});

const ABOUT_STORY_IMAGE_SRC =
  "content-media/therapists/2026/08/b17cf861-9ef993a5-750797197-1617088680024620-7808186723757096404-n-13.jpg";
const ABOUT_STORY_IMAGE_ALT = "Talk Space therapist seated in a counselling room";

const PRICING_FAQS = [
  {
    id: "payment-timing",
    question: "When is payment taken?",
    answer:
      "Payments are processed securely via Paystack when you book. If you need to reschedule or cancel, do so at least 48 hours in advance.",
  },
  {
    id: "payment-methods",
    question: "What payment methods do you accept?",
    answer:
      "Card (Visa, Mastercard, Verve), bank transfer and USSD via Paystack. Corporate invoicing is available for HR-sponsored programmes.",
  },
  {
    id: "diaspora-pricing",
    question: "Do you offer diaspora pricing?",
    answer:
      "Yes. USD equivalents are shown for each plan and you can pay in either currency via Paystack.",
  },
  {
    id: "package-booking",
    question: "Can I book a package rather than pay per session?",
    answer:
      "Yes. Our one-month plans (four sessions) are the most affordable way to commit to a short course of therapy.",
  },
];

const SERVICE_CARDS = [
  card(
    "svc-clarity",
    "Clarity Call",
    "A focused 15-minute first step.",
    "A short paid consultation for clients who want help choosing the right service, understanding next steps, or asking a focused question before booking therapy.",
    [
      "15-minute online or phone consultation",
      "Best for fit, direction and next-step guidance",
      "Not a full therapy session or emergency support",
    ],
    { src: "asset:african-team", alt: "African care team discussing a counselling intake plan" },
    "/book",
    "Book a clarity call",
  ),
  card(
    "svc-individual",
    "Individual Therapy",
    "One-to-one support, at your pace.",
    "For anxiety, depression, burnout, grief, self-esteem, identity and life transitions. Weekly or fortnightly 50-minute sessions with the same therapist throughout.",
    [
      "CBT, ACT, psychodynamic and integrative approaches",
      "Online video or in-person at our Lagos rooms",
      "Free 15-minute intro call available on request",
    ],
    {
      src: "asset:individual-therapy",
      alt: "A Nigerian therapist and client in a warm one-to-one counselling session",
    },
    "/book",
    "Book individual therapy",
    "dark",
  ),
  card(
    "svc-couple",
    "Couple Therapy",
    "For the relationship you want to keep growing.",
    "For couples navigating conflict, communication, intimacy, parenting differences, trust issues, or the pressure of repeated unresolved arguments.",
    [
      "Emotion-focused and Gottman-informed approaches",
      "75-minute sessions with a relational therapist",
      "Individual check-ins available alongside joint sessions",
    ],
    {
      src: "asset:couples-therapy",
      alt: "A young African couple holding hands during a couples therapy session",
    },
    "/book",
    "Book couple therapy",
  ),
  card(
    "svc-organizational",
    "Organizational Counselling",
    "Mental health support for healthier teams.",
    "For organisations that want confidential employee support, workplace wellness sessions, leadership coaching, and practical care for burnout, stress and team conflict.",
    [
      "EAP-style individual support for staff",
      "Team wellness sessions and psychoeducation",
      "Workplace conflict, burnout and leadership support",
    ],
    {
      src: "asset:african-team",
      alt: "African professionals in a calm workplace counselling conversation",
    },
    "/contact",
    "Talk to our team",
  ),
  card(
    "svc-premarital",
    "Premarital Counselling",
    "Prepare for marriage with clarity and care.",
    "Structured sessions for engaged or seriously committed partners who want to explore expectations, communication, family systems, faith, finances and shared values before marriage.",
    [
      "Communication, conflict and expectation mapping",
      "Values, finances, family boundaries and intimacy",
      "Personal and couple profiling where appropriate",
    ],
    {
      src: "asset:ts-marriage-couple",
      alt: "An African couple in a calm counselling conversation",
    },
    "/book",
    "Book premarital counselling",
  ),
  card(
    "svc-infidelity",
    "Infidelity Recovery Therapy",
    "Structured support after betrayal.",
    "Compassionate therapy for individuals or couples processing betrayal, disclosure, grief, anger, repair, boundaries, and decisions about whether and how to rebuild trust.",
    [
      "Stabilise emotions and reduce repeated conflict",
      "Process betrayal, disclosure and repair conversations",
      "Rebuild trust or make clear decisions with support",
    ],
    { src: "asset:african-couch", alt: "An African couple in a serious counselling conversation" },
    "/book",
    "Book infidelity recovery",
  ),
  card(
    "svc-teen",
    "Teen/Child Therapy",
    "Specialist care for younger clients.",
    "Support for children and adolescents experiencing behavioural concerns, anxiety, school-related stress, emotional regulation challenges or family transitions.",
    [
      "Behavioural, play-informed and art-informed therapy",
      "Parent guidance and family collaboration",
      "Age-appropriate care from specialist clinicians",
    ],
    {
      src: "asset:family-therapy",
      alt: "An African family seated together in a warm home setting",
    },
    "/book",
    "Book teen or child therapy",
    "dark",
  ),
  card(
    "svc-family",
    "Family Therapy",
    "Bring the whole system into the room.",
    "For families navigating conflict, sibling rivalry, blended households, elder care tension, parenting differences or major life transitions.",
    [
      "Systemic and structural family therapy",
      "Support for intergenerational relationships",
      "Sessions include the members most affected",
    ],
    {
      src: "asset:group-therapy",
      alt: "A small group of African adults in a circle in a family therapy session",
    },
    "/book",
    "Book family therapy",
  ),
];

const priceCard = (
  id: string,
  name: string,
  price: string,
  cadence: string,
  desc: string,
  features: string[],
  href: string,
  action: string,
) => card(id, name, `${price} · ${cadence}`, desc, features, { src: "", alt: "" }, href, action);

export const PUBLIC_PAGE_SEED: Record<PublicPageKey, PublicPageSeed> = {
  about: {
    title: "About Talk Space",
    excerptHtml:
      "<p>A Nigerian practice of licensed therapists offering confidential online and in-person counselling.</p>",
    sections: [
      {
        ...base({ surface: "cream", spacing: "lg", width: "wide" }),
        id: "about-hero",
        type: "hero",
        eyebrow: "About",
        heading: "Therapy that feels human, professional and",
        headingEmphasis: "close to home",
        headingAfter: ".",
        body: "Talk Space Counselling Services is a Nigerian practice of licensed therapists offering confidential online and in-person support for individuals, couples, families and teens.",
        image: { src: "asset:ts-hero-people", alt: "Talk Space therapists and clients" },
        links: [
          { id: "about-hero-book", label: "Book a session", href: "/book", variant: "primary" },
          {
            id: "about-hero-team",
            label: "Meet the therapists",
            href: "/therapists",
            variant: "outline",
          },
        ],
      },
      {
        ...base({ width: "wide" }),
        id: "about-values",
        type: "cardGrid",
        eyebrow: "Our values",
        heading: "Four commitments we hold every session.",
        body: "",
        columns: 4,
        cards: [
          card(
            "about-value-confidential",
            "Confidential by design",
            "",
            "Everything you share is private, protected and used only to help you.",
          ),
          card(
            "about-value-cultural",
            "Culturally grounded",
            "",
            "Therapists who understand family, faith, work and community in Nigeria.",
          ),
          card(
            "about-value-care",
            "Care over cure",
            "",
            "We meet you where you are, no jargon, no judgement, no rush.",
          ),
          card(
            "about-value-evidence",
            "Evidence-based",
            "",
            "CBT, ACT, EMDR, systemic and relational modalities, chosen for you.",
          ),
        ],
      },
      {
        ...base({ width: "wide" }),
        id: "about-story",
        type: "hero",
        eyebrow: "Our story",
        heading: "Built in Lagos. Made for anywhere you are.",
        headingEmphasis: "",
        headingAfter: "",
        body: "Talk Space began in 2017 with a simple observation: too many people in Nigeria who wanted therapy either could not find a therapist they trusted, could not afford the ones they did find, or were held back by stigma.\n\nToday, our care coordinators match hundreds of clients each month with licensed therapists, online across Nigeria, and in person at our rooms in Allen, Ikeja, Lagos. We keep our fees transparent, hold a limited number of sliding-scale slots, and never take payment until your session is confirmed.\n\nIf you are considering therapy for the first time, you are welcome here. The first conversation is often the hardest, and the most important.",
        image: {
          src: ABOUT_STORY_IMAGE_SRC,
          alt: ABOUT_STORY_IMAGE_ALT,
        },
        links: [],
      },
      bookCta(
        "about-cta",
        "Your healing starts with one conversation.",
        "Book a confidential session with a licensed Nigerian therapist, online or in person.",
      ),
    ],
  },

  services: {
    title: "Our services",
    excerptHtml:
      "<p>Clarity calls, individual, couple, workplace, premarital, infidelity recovery, teen and family counselling.</p>",
    sections: [
      {
        ...base({ surface: "cream", spacing: "lg", width: "wide", align: "center" }),
        id: "services-hero",
        type: "hero",
        eyebrow: "Our services",
        heading: "Care shaped around the",
        headingEmphasis: "person",
        headingAfter: "in front of us.",
        body: "Every Talk Space service is delivered by a licensed Nigerian therapist. Choose the format that fits, or ask us and we will recommend one after a short conversation.",
        image: { src: "", alt: "" },
        links: [
          { id: "services-hero-book", label: "Book a session", href: "/book", variant: "primary" },
          { id: "services-hero-price", label: "See pricing", href: "/pricing", variant: "outline" },
        ],
      },
      {
        ...base({ surface: "cream", width: "full", spacing: "sm" }),
        id: "services-gallery",
        type: "gallery",
        heading: "",
        speedSeconds: 50,
        images: SERVICE_CARDS.filter((service) => service.image.src).map((service) => ({
          id: `gal-${service.id}`,
          src: service.image.src,
          alt: service.image.alt,
          caption: service.title,
        })),
      },
      {
        ...base({ width: "wide", spacing: "lg" }),
        id: "services-list",
        type: "featureList",
        eyebrow: "",
        heading: "",
        body: "",
        cards: SERVICE_CARDS,
      },
      bookCta(
        "services-cta",
        "Not sure which service fits?",
        "Book a clarity call and we will recommend the right starting point.",
      ),
    ],
  },

  therapists: {
    title: "Therapists",
    excerptHtml:
      "<p>Meet Talk Space's licensed Nigerian therapists and counsellors, with online and in-person support.</p>",
    sections: [
      {
        ...base({ surface: "cream", spacing: "lg", width: "wide", align: "center" }),
        id: "therapists-hero",
        type: "hero",
        eyebrow: "Meet the team",
        heading: "Licensed, warm, and",
        headingEmphasis: "quietly excellent",
        headingAfter: ".",
        body: "Every Talk Space therapist is licensed to practise in Nigeria and holds training in psychology, counselling or a related clinical field. Our care coordinators match you with the therapist whose training and style best fit.",
        image: { src: "", alt: "" },
        links: [
          {
            id: "therapists-hero-book",
            label: "Request a session",
            href: "/book",
            variant: "primary",
          },
          {
            id: "therapists-hero-contact",
            label: "Ask for a match",
            href: "/contact",
            variant: "outline",
          },
        ],
      },
      {
        ...base({ width: "wide", spacing: "lg" }),
        id: "therapists-live",
        type: "therapistList",
        columns: 3,
        eyebrow: "",
        heading: "",
        body: "",
      },
      bookCta(
        "therapists-cta",
        "More clinicians, matched to you on request.",
        "Beyond the profiles above, Talk Space partners with a vetted network of licensed therapists across Nigeria.",
      ),
    ],
  },

  pricing: {
    title: "Pricing",
    excerptHtml:
      "<p>Transparent counselling fees for individuals, couples and families in Nigeria and the diaspora.</p>",
    sections: [
      {
        ...base({ surface: "cream", spacing: "lg", width: "wide", align: "left" }),
        id: "pricing-hero",
        type: "hero",
        eyebrow: "Affordable therapy plans",
        heading: "Professional counselling —",
        headingEmphasis: "accessible",
        headingAfter: ".",
        body: "Transparent fees for individuals, couples and families in Nigeria and the diaspora. Payments are processed securely.",
        image: { src: "", alt: "" },
        links: [
          {
            id: "pricing-hero-book",
            label: "Start secure booking",
            href: "/book",
            variant: "primary",
          },
        ],
      },
      {
        ...base({ width: "wide" }),
        id: "pricing-single",
        type: "cardGrid",
        eyebrow: "Single sessions",
        heading: "Pay per session.",
        body: "Best for first appointments, focused support, or clients who prefer to book one session at a time.",
        columns: 4,
        cards: [
          priceCard(
            "price-clarity",
            "Clarity Call",
            "Contact for pricing",
            "per 15-minute consultation",
            "A short paid call to choose the right service, ask a focused question, or plan your next step.",
            [
              "15-minute online or phone call",
              "Service-fit guidance",
              "Clear next-step recommendation",
              "Not a full therapy session",
            ],
            "/contact",
            "Request a call",
          ),
          priceCard(
            "price-individual",
            "Individual Therapy",
            "₦55,000",
            "per 60-minute session",
            "One-to-one online counselling tailored to your current concerns and treatment goals.",
            [
              "Online video session",
              "CBT-informed support",
              "Mindfulness and solution-focused tools",
              "Personalised next steps after session",
            ],
            "/book?service=individual&mode=online",
            "Start secure booking",
          ),
          priceCard(
            "price-couple",
            "Couple Therapy",
            "₦90,000",
            "per 90-minute session",
            "Structured couple therapy for communication, trust repair, conflict and emotional intimacy.",
            [
              "Online video session",
              "Couple assessment and profiling",
              "Communication and conflict skills",
              "Infidelity-sensitive support when needed",
            ],
            "/book?service=couple&mode=online",
            "Start secure booking",
          ),
          priceCard(
            "price-teen",
            "Child/Teen Therapy",
            "₦50,000",
            "per 60-minute session",
            "Specialist support for children and adolescents, with age-appropriate therapeutic methods.",
            [
              "Behavioural and emotional support",
              "School-related concerns",
              "Play, art and talk therapy methods",
              "Parent guidance where appropriate",
            ],
            "/contact",
            "Request a slot",
          ),
        ],
      },
      {
        ...base({ surface: "cream", width: "wide" }),
        id: "pricing-in-person",
        type: "cardGrid",
        eyebrow: "In-person sessions",
        heading: "Physical sessions at our rooms.",
        body: "For clients who prefer face-to-face support. In-person sessions are available by appointment.",
        columns: 4,
        cards: [
          priceCard(
            "price-in-person-individual",
            "Individual In-person Session",
            "₦85,000",
            "per 60-minute session",
            "One-to-one counselling in a private Talk Space room, tailored to your treatment goals.",
            [
              "Physical session by appointment",
              "Private counselling room",
              "CBT-informed support",
              "Personalised next steps after session",
            ],
            "/book?service=individual&mode=in_person",
            "Start secure booking",
          ),
          priceCard(
            "price-in-person-couple",
            "Couple In-person Session",
            "₦130,000",
            "per 90-minute session",
            "Face-to-face couple therapy for communication, trust repair, conflict and intimacy.",
            [
              "Physical couple session",
              "Couple assessment and profiling",
              "Communication and conflict skills",
              "Infidelity-sensitive support when needed",
            ],
            "/book?service=couple&mode=in_person",
            "Start secure booking",
          ),
          priceCard(
            "price-in-person-month-individual",
            "One-Month Individual In-person",
            "₦323,000",
            "4 individual sessions monthly",
            "Four face-to-face individual therapy sessions with the same therapist.",
            [
              "Four physical sessions",
              "Consistent therapist match",
              "Progress tracking between sessions",
              "Structured short-course care",
            ],
            "/purchase?service=one_month_individual&mode=in_person",
            "Purchase sessions",
          ),
          priceCard(
            "price-in-person-month-couple",
            "One-Month Couple In-person",
            "₦494,000",
            "4 couple sessions monthly",
            "A structured month of in-person couple therapy for reconnection and repair.",
            [
              "Four physical couple sessions",
              "Assessment-led treatment plan",
              "Communication and intimacy work",
              "Support for recurring conflict cycles",
            ],
            "/purchase?service=one_month_couple&mode=in_person",
            "Purchase sessions",
          ),
        ],
      },
      {
        ...base({ surface: "cream", width: "wide" }),
        id: "pricing-monthly",
        type: "cardGrid",
        eyebrow: "Monthly packages",
        heading: "Commit to a short course of care.",
        body: "Four-session plans for clients who want rhythm, continuity and a clearer therapeutic arc.",
        columns: 3,
        cards: [
          priceCard(
            "price-month-individual",
            "Individual Plan",
            "₦210,000",
            "4 individual sessions monthly",
            "A focused month of individual therapy with the same therapist and structured follow-up.",
            [
              "Four online sessions",
              "Consistent therapist match",
              "Progress tracking between sessions",
              "Most affordable individual route",
            ],
            "/purchase?service=one_month_individual&mode=online",
            "Purchase sessions",
          ),
          priceCard(
            "price-month-couple",
            "Couple Plan",
            "₦342,000",
            "4 couple sessions monthly",
            "A structured month of couple therapy for communication, reconnection and repair.",
            [
              "Four online couple sessions",
              "Assessment-led treatment plan",
              "Communication and intimacy work",
              "Support for recurring conflict cycles",
            ],
            "/purchase?service=one_month_couple&mode=online",
            "Purchase sessions",
          ),
          priceCard(
            "price-month-premarital",
            "Premarital Plan",
            "Contact for pricing",
            "structured premarital package",
            "Guided sessions for engaged or seriously committed partners preparing for marriage.",
            [
              "Communication and expectations",
              "Family systems and in-law conversations",
              "Finance, faith and shared values",
              "Personalised couple recommendations",
            ],
            "/contact",
            "Ask for package",
          ),
        ],
      },
      {
        ...base({ width: "wide" }),
        id: "pricing-specialized",
        type: "cardGrid",
        eyebrow: "Specialized packages",
        heading: "Care for complex or specialist needs.",
        body: "Specialist support for deeper therapeutic work, relationship repair and workplace wellbeing.",
        columns: 3,
        cards: [
          priceCard(
            "price-psychotherapy",
            "Psychotherapy",
            "Contact for pricing",
            "extended therapeutic work",
            "Longer-term therapy for trauma, complex grief and deeper psychological work.",
            [
              "Trauma-informed practice",
              "Longer therapeutic arc",
              "Regular clinical review",
              "Referral support where needed",
            ],
            "/contact",
            "Discuss psychotherapy",
          ),
          priceCard(
            "price-infidelity",
            "Infidelity Recovery",
            "Contact for pricing",
            "structured recovery package",
            "Structured support after betrayal, for individuals or couples deciding how to move forward.",
            [
              "Stabilise conflict and emotion",
              "Guided disclosure conversations",
              "Trust repair or clear decisions",
              "Individual and joint sessions",
            ],
            "/contact",
            "Ask about recovery",
          ),
          priceCard(
            "price-organizational",
            "Organizational Counselling",
            "Contact for pricing",
            "per organisation, scoped to need",
            "Confidential employee support, wellness sessions and leadership coaching for teams.",
            [
              "EAP-style staff support",
              "Team wellness sessions",
              "Burnout and conflict support",
              "Reporting on uptake, never on identities",
            ],
            "/contact",
            "Request a proposal",
          ),
        ],
      },
      {
        ...base({ surface: "deep", width: "content" }),
        id: "pricing-note",
        type: "callout",
        eyebrow: "Good to know",
        heading: "Fees are always confirmed before your session.",
        body: "Sliding-scale slots are limited and awarded at our discretion. If cost is a barrier, tell us and we will look at the options with you.",
        bullets: [
          "No payment is taken until your appointment is confirmed",
          "Reschedule free of charge up to 48 hours before your session",
          "Multi-session plans are refundable pro-rata within 60 days",
        ],
      },
      {
        ...base({ width: "wide", spacing: "lg" }),
        id: "pricing-faq",
        type: "faq",
        eyebrow: "Billing FAQ",
        heading: "Common questions about fees.",
        body: "",
        items: PRICING_FAQS,
      },
    ],
  },

  contact: {
    title: "Contact us",
    excerptHtml:
      "<p>Reach Talk Space by WhatsApp, phone or email. Offices in Lagos and Abuja, Mon-Fri 9am-5pm WAT.</p>",
    sections: [
      {
        ...base({ surface: "cream", spacing: "lg", width: "wide", align: "center" }),
        id: "contact-hero",
        type: "hero",
        eyebrow: "Get in touch",
        heading: "A calm place to",
        headingEmphasis: "reach us",
        headingAfter: ".",
        body: "Our care team responds within one working day. If you are in a crisis right now, please see our emergency support page.",
        image: { src: "", alt: "" },
        links: [
          {
            id: "contact-hero-emergency",
            label: "Emergency support",
            href: "/emergency-support",
            variant: "outline",
          },
        ],
      },
      {
        ...base({ width: "wide" }),
        id: "contact-channels",
        type: "cardGrid",
        eyebrow: "",
        heading: "",
        body: "",
        columns: 3,
        cards: [
          card(
            "contact-whatsapp",
            "WhatsApp",
            "Fastest response · Mon-Fri, 9am-5pm",
            "+234 704 846 9090",
            [],
            { src: "", alt: "" },
            "https://wa.me/2347048469090",
            "Open in WhatsApp",
          ),
          card(
            "contact-phone",
            "Phone (Nigeria)",
            "Mon-Fri, 9am-5pm WAT",
            "+234 809 993 1039",
            [],
            { src: "", alt: "" },
            "tel:+2348099931039",
            "Call now",
          ),
          card(
            "contact-email",
            "Email",
            "Replies within one working day",
            "hello@talkspace.ng",
            [],
            { src: "", alt: "" },
            "mailto:hello@talkspace.ng",
            "Send an email",
          ),
        ],
      },
      {
        ...base({ width: "wide" }),
        id: "contact-offices",
        type: "cardGrid",
        eyebrow: "",
        heading: "",
        body: "",
        columns: 3,
        cards: [
          card(
            "contact-abuja",
            "Abuja (FCT)",
            "",
            "Plot 153A, T-Pumpy Estate\nOpp. NIU Estate, Off Saburi 1, FCT, Abuja",
            ["In-person sessions by appointment only."],
          ),
          card(
            "contact-lagos",
            "Talk Space Counseling, Lagos",
            "",
            "Abiodun Oshowole Cl, off Oluwaleimu Street\nAllen, Ikeja 101233, Lagos",
            ["In-person sessions by appointment only."],
          ),
          card("contact-hours", "Hours", "", "", [
            "Monday to Friday: 9:00 to 17:00",
            "Saturday: By appointment",
            "Sunday: Closed",
          ]),
        ],
      },
      {
        ...base({ width: "content", spacing: "lg" }),
        id: "contact-form",
        type: "contactForm",
        eyebrow: "Send a message",
        heading: "Tell us what you need.",
        body: "We reply within one working day. For emergencies, please use our crisis resources.",
      },
    ],
  },

  faqs: {
    title: "Frequently asked questions",
    excerptHtml:
      "<p>Answers about confidentiality, matching, online versus in-person sessions, fees and more.</p>",
    sections: [
      {
        ...base({ surface: "cream", spacing: "lg", width: "wide", align: "center" }),
        id: "faqs-hero",
        type: "hero",
        eyebrow: "FAQs",
        heading: "Questions, answered",
        headingEmphasis: "honestly",
        headingAfter: ".",
        body: "Everything clients usually ask before a first session. If your question is not here, message us and we will answer it directly.",
        image: { src: "", alt: "" },
        links: [
          {
            id: "faqs-hero-contact",
            label: "Ask us a question",
            href: "/contact",
            variant: "outline",
          },
        ],
      },
      {
        ...base({ width: "content", spacing: "lg" }),
        id: "faqs-live",
        type: "faqList",
        eyebrow: "",
        heading: "",
        body: "",
      },
      bookCta(
        "faqs-cta",
        "Ready when you are.",
        "Book a confidential session, or send us a question first.",
      ),
    ],
  },

  "privacy-policy": {
    title: "Privacy Policy",
    excerptHtml:
      "<p>How Talk Space collects, uses and protects your personal and clinical information.</p>",
    sections: [
      {
        ...base({ width: "narrow", spacing: "lg" }),
        id: "privacy-hero",
        type: "hero",
        eyebrow: "Legal",
        heading: "Privacy Policy",
        headingEmphasis: "",
        headingAfter: "",
        body: "Last updated: 1 January 2026",
        image: { src: "", alt: "" },
        links: [],
      },
      prose("privacy-who", "Who we are", [
        "Talk Space Counselling Services Ltd (“Talk Space”, “we”, “us”) is a Nigerian mental-health provider registered in Lagos. This policy explains how we handle your personal and health information under the Nigeria Data Protection Act 2023 (NDPA).",
      ]),
      prose("privacy-collect", "What we collect", [
        "We collect the details you share when booking or attending a session (name, contact details, brief clinical notes), technical information from our website (device, IP, cookies for essential functionality), and payment references from our payment processor. We do not collect payment card numbers directly.",
      ]),
      prose("privacy-use", "How we use it", [
        "We use your information to deliver the counselling you have asked for, to schedule and bill sessions, to keep clinical records as required by professional standards, and to respond when you contact us. Aggregated, de-identified data may be used to improve our services.",
      ]),
      prose("privacy-confidentiality", "Confidentiality", [
        "Sessions are private and protected by professional ethics. We only share information with your explicit consent, or where required by law, for example, a real and imminent risk to life, or a valid court order. Where possible, we tell you first.",
      ]),
      prose("privacy-protect", "How we protect it", [
        "We use encrypted video, encrypted storage and role-based access. Clinical notes are accessible only to your therapist and, where needed for care, a named clinical supervisor. Staff are trained on data protection annually.",
      ]),
      prose("privacy-rights", "Your rights", [
        "You can ask us for a copy of the personal data we hold about you, correct anything inaccurate, withdraw consent, or ask us to delete data we no longer need to keep. Email privacy@talkspace.ng and we will respond within 30 days.",
      ]),
      prose("privacy-contact", "Contact", [
        "Questions about this policy? Email privacy@talkspace.ng or write to the Data Protection Officer, Talk Space Counselling Services, Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos.",
      ]),
    ],
  },

  terms: {
    title: "Terms of Service",
    excerptHtml: "<p>The terms that govern your use of Talk Space Counselling Services.</p>",
    sections: [
      {
        ...base({ width: "narrow", spacing: "lg" }),
        id: "terms-hero",
        type: "hero",
        eyebrow: "Legal",
        heading: "Terms of Service",
        headingEmphasis: "",
        headingAfter: "",
        body: "Last updated: 1 January 2026",
        image: { src: "", alt: "" },
        links: [],
      },
      prose("terms-about", "About these terms", [
        "These terms govern your use of Talk Space Counselling Services (“Talk Space”). By booking a session or using our website you agree to them. If you do not agree, please do not use the service.",
      ]),
      prose("terms-emergency", "Not an emergency service", [
        "Talk Space is not a crisis or emergency service. If you or someone you know is at immediate risk, call 112 or use the numbers on our emergency support page.",
      ]),
      prose("terms-who", "Who can use Talk Space", [
        "You must be 18 or over to book for yourself. Sessions for minors (13-17) must be booked by a parent or legal guardian, who will sign our consent forms.",
      ]),
      prose("terms-payment", "Sessions and payment", [
        "Fees are shown on our pricing page and confirmed before your session. Payment is taken only after your session is confirmed. Sliding-scale slots are limited and awarded at our discretion.",
      ]),
      prose("terms-cancellations", "Cancellations and refunds", [
        "You can reschedule up to 48 hours before your session at no charge. Please see our cancellation and refund policy for the full detail.",
      ]),
      prose("terms-responsibilities", "Your responsibilities", [
        "You agree to give accurate information at booking, to attend sessions in an environment where you feel safe and undisturbed, and to not record sessions without your therapist's consent.",
      ]),
      prose("terms-liability", "Limitation of liability", [
        "Talk Space provides counselling but cannot guarantee specific outcomes. Our liability for loss arising from use of the service is limited to fees paid in the twelve months before the event giving rise to the claim.",
      ]),
      prose("terms-law", "Governing law", [
        "These terms are governed by the laws of the Federal Republic of Nigeria. Disputes are subject to the exclusive jurisdiction of the courts of Lagos State.",
      ]),
    ],
  },

  "cancellation-refund-policy": {
    title: "Cancellation & refund policy",
    excerptHtml: "<p>How cancellations, reschedules and refunds work at Talk Space.</p>",
    sections: [
      {
        ...base({ width: "narrow", spacing: "lg" }),
        id: "cancel-hero",
        type: "hero",
        eyebrow: "Legal",
        heading: "Cancellation & refund policy",
        headingEmphasis: "",
        headingAfter: "",
        body: "Last updated: 1 January 2026",
        image: { src: "", alt: "" },
        links: [],
      },
      prose("cancel-intro", "", [
        "We hold your therapist's time exclusively for you. This policy helps us keep fees affordable while respecting our clinicians' schedules. Please contact us by email, WhatsApp, phone call, or your booking link at least 48 hours before your session if you need to reschedule or cancel.",
      ]),
      {
        ...base({ width: "narrow" }),
        id: "cancel-table",
        type: "richText",
        heading: "Notice and fees",
        html: `<table><thead><tr><th>When you tell us</th><th>Fee</th><th>Notes</th></tr></thead><tbody><tr><td>At least 48 hours before</td><td>No charge</td><td>Reschedule or cancel by email, WhatsApp, phone call, or your booking link.</td></tr><tr><td>Below 48 hours before, or no-show</td><td>Full session fee forfeited</td><td>Late changes are not accepted because your therapist's time is already committed.</td></tr><tr><td>Cancelled by Talk Space</td><td>Full refund or free reschedule</td><td>We will offer the next available slot with your therapist.</td></tr></tbody></table>`,
      },
      prose("cancel-plans", "Refunds on plans", [
        "For multi-session plans, unused sessions are refundable within 60 days of purchase, pro-rated at the single-session rate. Refunds are processed within 7 working days to the original payment method.",
      ]),
      prose("cancel-groups", "Group cohorts", [
        "Group fees are refundable in full up to 7 days before the cohort begins. After that, we can transfer your place to the next cohort but cannot refund the fee, as facilitator time and materials are committed.",
      ]),
      prose("cancel-ask", "Ask us anything", [
        'If a fee has been applied that you would like to discuss, please email hello@talkspace.ng or <a href="/contact">contact us</a>. We review every request individually.',
      ]),
    ],
  },

  "emergency-support": {
    title: "Emergency support",
    excerptHtml:
      "<p>Talk Space is not an emergency service. Use these Nigerian crisis lines if you are in danger.</p>",
    sections: [
      {
        ...base({ surface: "deep", width: "wide" }),
        id: "emergency-banner",
        type: "callout",
        eyebrow: "Important",
        heading: "Talk Space is not an emergency service.",
        body: "If you or someone you know is in immediate danger, use the numbers on this page. If life is at immediate risk, dial 112 and stay on the line.",
        bullets: [],
      },
      {
        ...base({ width: "wide", spacing: "lg" }),
        id: "emergency-hero",
        type: "hero",
        eyebrow: "Emergency support",
        heading: "If you or someone you know is in immediate danger,",
        headingEmphasis: "call for help now",
        headingAfter: ".",
        body: "These Nigerian crisis lines are free, confidential and answered by trained responders.",
        image: { src: "", alt: "" },
        links: [{ id: "emergency-112", label: "Call 112", href: "tel:112", variant: "primary" }],
      },
      {
        ...base({ width: "wide" }),
        id: "emergency-lines",
        type: "cardGrid",
        eyebrow: "Crisis lines",
        heading: "Free, confidential, 24/7.",
        body: "",
        columns: 2,
        cards: [
          card(
            "line-112",
            "Nigeria Emergency Services",
            "112 · 24 hours, 7 days a week",
            "Police, ambulance, fire and rescue.",
            [],
            { src: "", alt: "" },
            "tel:112",
            "Call 112",
          ),
          card(
            "line-mani",
            "Mentally Aware Nigeria (MANI)",
            "0809 210 6493 · 24 hours, 7 days a week",
            "Mental health crisis and emotional distress.",
            [],
            { src: "", alt: "" },
            "tel:+2348092106493",
            "Call MANI",
          ),
          card(
            "line-surpin",
            "Suicide Research and Prevention Initiative (SURPIN)",
            "0806 210 6493 or 0809 210 6493 · 24 hours, 7 days a week",
            "Suicide prevention and crisis intervention.",
            [],
            { src: "", alt: "" },
            "tel:+2348062106493",
            "Call SURPIN",
          ),
          card(
            "line-dsva",
            "Lagos State Domestic and Sexual Violence Agency",
            "0813 796 0048 · 24 hours, 7 days a week",
            "Domestic violence, sexual assault and abuse support.",
            [],
            { src: "", alt: "" },
            "tel:+2348137960048",
            "Call DSVA",
          ),
        ],
      },
      {
        ...base({ surface: "cream", width: "wide" }),
        id: "emergency-expect",
        type: "cardGrid",
        eyebrow: "What to expect",
        heading: "Calling a crisis line.",
        body: "",
        columns: 4,
        cards: [
          card(
            "expect-call",
            "Pick up the phone",
            "",
            "Dial the number that matches your situation. All calls are free.",
          ),
          card(
            "expect-responder",
            "Speak to a responder",
            "",
            "A trained crisis responder will listen, assess and guide you to safety.",
          ),
          card(
            "expect-confidential",
            "Your call is confidential",
            "",
            "Crisis lines do not share your identity or details without your consent.",
          ),
          card(
            "expect-stay",
            "Stay on the line",
            "",
            "If life is at immediate risk, call 112 and stay on the line until help arrives.",
          ),
        ],
      },
      bookCta(
        "emergency-cta",
        "When the crisis has passed, we are here.",
        "Talk Space offers confidential counselling for what comes next.",
      ),
    ],
  },
};
