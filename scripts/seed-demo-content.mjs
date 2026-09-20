import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !adminKey) {
  throw new Error(
    "Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY, plus SUPABASE_URL or VITE_SUPABASE_URL before seeding demo content.",
  );
}

if (adminKey.startsWith("sb_publishable_") || adminKey.startsWith("sb_anon_")) {
  throw new Error(
    "The configured Supabase key is public. Use the server-only sb_secret_... key as SUPABASE_SECRET_KEY, never the VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const mediaBucket = "content-media";

const defaultSiteDetails = {
  brandName: "Talk Space Counselling Services",
  tagline: "Confidential. Professional. Accessible.",
  email: "hello@talkspace.ng",
  phone: "+234 809 993 1039",
  whatsapp: "+234 704 846 9090",
  hours: "Mon to Fri · 9:00 am to 5:00 pm WAT",
  facebook: "https://facebook.com/talkspaceng",
  twitter: "https://twitter.com/talkspace_ng",
  instagram: "https://instagram.com/talkspace_ng",
  linkedin: "https://www.linkedin.com/company/talkspaceng",
  youtube: "https://www.youtube.com/@talkspaceng",
  // An empty path selects the responsive text wordmark. Administrators can still
  // replace it with a custom uploaded logo in Site settings.
  logoPath: "",
  faviconPath: "/favicon.ico",
  socialImagePath: "/og-image.jpg",
  appearance: {
    backgroundColor: "#fbfaf7",
    textColor: "#253044",
    accentColor: "#c27b67",
    bodyFont: "sans",
    headingFont: "display",
    baseFontSize: "md",
    buttonStyle: "rounded",
    sectionSpacing: "comfortable",
  },
};

const demoImages = [
  {
    sourceHash: "demo-media-hero-1",
    storagePath: "demo/hero-1.jpg",
    sourceFilename: "unsplash-african-women-conversation.jpg",
    fileUrl: new URL("../src/assets/unsplash-african-women-conversation.jpg", import.meta.url),
    mimeType: "image/jpeg",
    altText: "A warm counselling conversation in a bright room",
    tags: ["demo", "homepage", "hero"],
  },
  {
    sourceHash: "demo-media-hero-2",
    storagePath: "demo/hero-2.jpg",
    sourceFilename: "unsplash-african-team-session.jpg",
    fileUrl: new URL("../src/assets/unsplash-african-team-session.jpg", import.meta.url),
    mimeType: "image/jpeg",
    altText: "A supportive group counselling session",
    tags: ["demo", "homepage", "hero"],
  },
  {
    sourceHash: "demo-media-carousel-1",
    storagePath: "demo/carousel-1.jpg",
    sourceFilename: "individual-therapy.jpg",
    fileUrl: new URL("../src/assets/individual-therapy.jpg", import.meta.url),
    mimeType: "image/jpeg",
    altText: "Individual therapy in a calm consultation room",
    tags: ["demo", "carousel", "therapy"],
  },
  {
    sourceHash: "demo-media-carousel-2",
    storagePath: "demo/carousel-2.jpg",
    sourceFilename: "couples-therapy.jpg",
    fileUrl: new URL("../src/assets/couples-therapy.jpg", import.meta.url),
    mimeType: "image/jpeg",
    altText: "Couples counselling in a comfortable shared space",
    tags: ["demo", "carousel", "therapy"],
  },
  {
    sourceHash: "demo-media-carousel-3",
    storagePath: "demo/carousel-3.webp",
    sourceFilename: "ts-ptsd.webp",
    fileUrl: new URL("../src/assets/ts-ptsd.webp", import.meta.url),
    mimeType: "image/webp",
    altText: "Trauma-informed therapy support",
    tags: ["demo", "carousel", "therapy"],
  },
  {
    sourceHash: "demo-media-avatar-1",
    storagePath: "demo/avatar-1.jpg",
    sourceFilename: "therapist-1.jpg",
    fileUrl: new URL("../src/assets/therapist-1.jpg", import.meta.url),
    mimeType: "image/jpeg",
    altText: "Therapist profile portrait",
    tags: ["demo", "avatar", "testimonial"],
  },
  {
    sourceHash: "demo-media-avatar-2",
    storagePath: "demo/avatar-2.jpg",
    sourceFilename: "therapist-2.jpg",
    fileUrl: new URL("../src/assets/therapist-2.jpg", import.meta.url),
    mimeType: "image/jpeg",
    altText: "Therapist profile portrait",
    tags: ["demo", "avatar", "testimonial"],
  },
  {
    sourceHash: "demo-media-avatar-3",
    storagePath: "demo/avatar-3.jpg",
    sourceFilename: "therapist-3.jpg",
    fileUrl: new URL("../src/assets/therapist-3.jpg", import.meta.url),
    mimeType: "image/jpeg",
    altText: "Therapist profile portrait",
    tags: ["demo", "avatar", "testimonial"],
  },
];

const demoTestimonials = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    authorName: "Amina Yusuf",
    authorRole: "Happy Client",
    quote:
      "The demo content made it easy to test the homepage carousel and the booking flow without touching production copy.",
    rating: 5,
    avatarUrl: "demo/avatar-1.jpg",
    isPublished: true,
    displayOrder: 10,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    authorName: "Chinedu Okafor",
    authorRole: "Returning Client",
    quote:
      "Everything feels more complete now — there are clear images, working labels, and enough sample data to verify each section.",
    rating: 5,
    avatarUrl: "demo/avatar-2.jpg",
    isPublished: true,
    displayOrder: 20,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    authorName: "Ifeoma Eze",
    authorRole: "Client Advocate",
    quote:
      "Being able to see actual testimonials on the page makes it much easier to review spacing, image handling, and mobile layout.",
    rating: 5,
    avatarUrl: "demo/avatar-3.jpg",
    isPublished: true,
    displayOrder: 30,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    authorName: "Daniel Balogun",
    authorRole: "Demo User",
    quote:
      "I can now check the reviews carousel, the CMS screens, and the editor flow without needing to seed anything manually first.",
    rating: 4,
    avatarUrl: "demo/avatar-1.jpg",
    isPublished: true,
    displayOrder: 40,
  },
];

const demoEntries = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    kind: "page",
    sourceId: 990001,
    slug: "demo-homepage-builder",
    canonicalPath: "/content/pages/demo-homepage-builder",
    title: "Demo Homepage Builder",
    excerptHtml:
      "<p>A starter page for testing the page editor, template selector, and featured image updates.</p>",
    bodyHtml:
      "<h2>Demo homepage builder</h2><p>This page exists so you can test the CMS without touching live content. Edit the body, switch the template, and save a new featured image to confirm the preview updates end to end.</p><ul><li>Try the default template.</li><li>Try the landing template.</li><li>Swap the featured image.</li></ul>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-1.jpg",
    metadata: {
      template: "landing",
      sectionBlocks: [
        {
          type: "intro",
          heading: "Test the page editor",
          body: "Use this page to validate body edits, template swaps, and preview changes.",
          items: ["Rich text body", "Template change", "Featured image"],
        },
        {
          type: "cta",
          heading: "Save and verify",
          body: "When you save, the public page should reflect the new layout.",
          items: ["Preview", "Publish", "Reopen"],
        },
      ],
    },
    publishedAt: "2026-07-29T09:00:00.000Z",
    sourceModifiedAt: "2026-07-29T09:00:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    kind: "page",
    sourceId: 990002,
    slug: "demo-service-overview",
    canonicalPath: "/content/pages/demo-service-overview",
    title: "Demo Service Overview",
    excerptHtml:
      "<p>A second page for testing a more traditional content layout with a different template.</p>",
    bodyHtml:
      "<h2>Service overview</h2><p>This demo page is designed to give you a second editing surface. It is useful for checking how multiple page types behave when you switch between templates and publish changes.</p>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-2.jpg",
    metadata: {
      template: "default",
      sectionBlocks: [
        {
          type: "features",
          heading: "What to check",
          body: "Use this page to confirm text styling, spacing, and image placement.",
          items: ["Typography", "Spacing", "Image preview"],
        },
      ],
    },
    publishedAt: "2026-07-29T09:15:00.000Z",
    sourceModifiedAt: "2026-07-29T09:15:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000101",
    kind: "post",
    sourceId: 990101,
    slug: "demo-first-session-guide",
    canonicalPath: "/content/posts/demo-first-session-guide",
    title: "What to Expect in a First Session",
    excerptHtml:
      "<p>A simple demo post that helps verify the article template, featured image, and body copy rendering.</p>",
    bodyHtml:
      "<h2>What to expect in a first session</h2><p>This demo article gives the blog section something realistic to render. Update the intro, swap the image, and confirm the public article page still behaves as expected.</p>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/carousel-1.jpg",
    metadata: {
      template: "article",
      tags: ["demo", "booking", "blog"],
    },
    publishedAt: "2026-07-29T09:30:00.000Z",
    sourceModifiedAt: "2026-07-29T09:30:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000102",
    kind: "post",
    sourceId: 990102,
    slug: "demo-homepage-setup-notes",
    canonicalPath: "/content/posts/demo-homepage-setup-notes",
    title: "Homepage Setup Notes",
    excerptHtml:
      "<p>A companion article for testing the blog list, featured media, and post routing.</p>",
    bodyHtml:
      "<h2>Homepage setup notes</h2><p>This post is here so the public blog has more than one visible item and the admin list has a richer set of statuses to work with.</p>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/carousel-2.jpg",
    metadata: {
      template: "article",
      tags: ["demo", "cms", "content"],
    },
    publishedAt: "2026-07-29T09:45:00.000Z",
    sourceModifiedAt: "2026-07-29T09:45:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000110",
    kind: "page",
    sourceId: 990011,
    slug: "about",
    canonicalPath: "/content/pages/about",
    title: "About Talk Space",
    excerptHtml:
      "<p>Meet the team behind Talk Space and our mission to make professional counselling accessible across Nigeria.</p>",
    bodyHtml:
      "<h2>Our mission</h2><p>Talk Space exists to offer confidential, culturally grounded counselling that is affordable, professional and accessible across Nigeria.</p><h3>What we believe</h3><ul><li>Care should be compassionate and judgement-free.</li><li>Therapy should be informed by culture and context.</li><li>Access should be clear, transparent and safe.</li></ul><h3>How we work</h3><p>We combine online and in-person sessions with a trusted team of licensed counsellors to deliver consistent support and practical next steps.</p>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-1.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T10:00:00.000Z",
    sourceModifiedAt: "2026-07-29T10:00:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000111",
    kind: "page",
    sourceId: 990012,
    slug: "services",
    canonicalPath: "/content/pages/services",
    title: "Services",
    excerptHtml:
      "<p>Explore our counselling and workplace support services for individuals, couples, families, teens and organisations.</p>",
    bodyHtml:
      "<h2>Our services</h2><p>Talk Space offers a range of counselling services designed for different needs and relationships.</p><h3>Individual therapy</h3><p>One-to-one sessions for anxiety, depression, burnout, grief and identity questions.</p><h3>Couple therapy</h3><p>Support for relationship communication, conflict repair and intimacy.</p><h3>Family and teen therapy</h3><p>Support for families and younger clients with age-appropriate care and family-informed approaches.</p><h3>Organisational counselling</h3><p>Workplace wellbeing, leadership coaching and confidential staff support for employers.</p>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/carousel-2.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T10:10:00.000Z",
    sourceModifiedAt: "2026-07-29T10:10:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000112",
    kind: "page",
    sourceId: 990013,
    slug: "pricing",
    canonicalPath: "/content/pages/pricing",
    title: "Pricing",
    excerptHtml:
      "<p>Transparent fees for individual, couple and family counselling plans, with secure payment options.</p>",
    bodyHtml:
      "<h2>Pricing at Talk Space</h2><p>Our fees are designed to be clear and accessible. Choose an individual session, couple therapy, teen support or a short course of counselling.</p><h3>How we price services</h3><p>Fees are set per session, with package options available for ongoing support and follow-up care. We accept secure payment methods including Paystack.</p><h3>Next steps</h3><p>Contact us to confirm availability and to book the plan that is right for you.</p>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-2.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T10:20:00.000Z",
    sourceModifiedAt: "2026-07-29T10:20:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000113",
    kind: "page",
    sourceId: 990014,
    slug: "contact",
    canonicalPath: "/content/pages/contact",
    title: "Contact",
    excerptHtml:
      "<p>Reach Talk Space by WhatsApp, phone, email or the form below. We reply within one working day.</p>",
    bodyHtml: `<h2>A calm place to reach us</h2><p>Our care team responds within one working day. If you are in crisis right now, please see our <a href="/emergency-support">emergency support page</a>.</p><h3>WhatsApp, phone and email</h3><p>The fastest way to reach us is via WhatsApp, phone or email.</p><h3>Send a message</h3><p>Use our contact form to tell us about your needs and we will follow up promptly.</p><h3>Need help urgently?</h3><p>If you are in crisis, please use the emergency support page for Nigerian crisis line numbers.</p>`,
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-1.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T10:30:00.000Z",
    sourceModifiedAt: "2026-07-29T10:30:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000114",
    kind: "page",
    sourceId: 990015,
    slug: "privacy-policy",
    canonicalPath: "/content/pages/privacy-policy",
    title: "Privacy policy",
    excerptHtml:
      "<p>How Talk Space collects, uses and protects your personal and health information under the Nigeria Data Protection Act.</p>",
    bodyHtml: `<h2>Who we are</h2><p>Talk Space Counselling Services Ltd (“Talk Space”, “we”, “us”) is a Nigerian mental-health provider registered in Lagos. This policy explains how we handle your personal and health information under the Nigeria Data Protection Act 2023 (NDPA).</p><h2>What we collect</h2><p>We collect the details you share when booking or attending a session (name, contact details, brief clinical notes), technical information from our website (device, IP, cookies for essential functionality), and payment references from our payment processor. We do not collect payment card numbers directly.</p><h2>How we use it</h2><p>We use your information to deliver the counselling you have asked for, to schedule and bill sessions, to keep clinical records as required by professional standards, and to respond when you contact us. Aggregated, de-identified data may be used to improve our services.</p><h2>Confidentiality</h2><p>Sessions are private and protected by professional ethics. We only share information with your explicit consent, or where required by law, for example, a real and imminent risk to life, or a valid court order. Where possible, we tell you first.</p><h2>How we protect it</h2><p>We use encrypted video, encrypted storage and role-based access. Clinical notes are accessible only to your therapist and, where needed for care, a named clinical supervisor. Staff are trained on data protection annually.</p><h2>Your rights</h2><p>You can ask us for a copy of the personal data we hold about you, correct anything inaccurate, withdraw consent, or ask us to delete data we no longer need to keep. Email privacy@talkspace.ng and we will respond within 30 days.</p><h2>Contact</h2><p>Questions about this policy? Email privacy@talkspace.ng or write to the Data Protection Officer, Talk Space Counselling Services, 20, Estaport Avenue, Gbagada, Lagos.</p>`,
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-2.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T10:40:00.000Z",
    sourceModifiedAt: "2026-07-29T10:40:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000115",
    kind: "page",
    sourceId: 990016,
    slug: "terms",
    canonicalPath: "/content/pages/terms",
    title: "Terms of Service",
    excerptHtml:
      "<p>Terms that govern your use of Talk Space counselling services and website in Nigeria.</p>",
    bodyHtml: `<h2>About these terms</h2><p>These terms govern your use of Talk Space Counselling Services (“Talk Space”). By booking a session or using our website you agree to them. If you do not agree, please do not use the service.</p><h2>Not an emergency service</h2><p>Talk Space is not a crisis or emergency service. If you or someone you know is at immediate risk, call 112 or use the numbers on our emergency support page.</p><h2>Who can use Talk Space</h2><p>You must be 18 or over to book for yourself. Sessions for minors (13-17) must be booked by a parent or legal guardian, who will sign our consent forms.</p><h2>Sessions and payment</h2><p>Fees are shown on our pricing page and confirmed before your session. Payment is taken only after your session is confirmed. Sliding-scale slots are limited and awarded at our discretion.</p><h2>Cancellations and refunds</h2><p>You can reschedule up to 24 hours before your session at no charge. Please see our cancellation and refund policy for the full detail.</p><h2>Your responsibilities</h2><p>You agree to give accurate information at booking, to attend sessions in an environment where you feel safe and undisturbed, and to not record sessions without your therapist's consent.</p><h2>Limitation of liability</h2><p>Talk Space provides counselling but cannot guarantee specific outcomes. Our liability for loss arising from use of the service is limited to fees paid in the twelve months before the event giving rise to the claim.</p><h2>Governing law</h2><p>These terms are governed by the laws of the Federal Republic of Nigeria. Disputes are subject to the exclusive jurisdiction of the courts of Lagos State.</p>`,
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-1.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T10:50:00.000Z",
    sourceModifiedAt: "2026-07-29T10:50:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000116",
    kind: "page",
    sourceId: 990017,
    slug: "emergency-support",
    canonicalPath: "/content/pages/emergency-support",
    title: "Emergency support",
    excerptHtml:
      "<p>Talk Space is not an emergency service. If you need immediate help, use these Nigerian crisis lines.</p>",
    bodyHtml: `<h2>Emergency support</h2><p>Talk Space is not an emergency service. If you or someone you know is in immediate danger, use these Nigerian crisis lines and emergency numbers.</p><h2>Crisis lines</h2><ul><li><strong>Nigeria Emergency Services:</strong> 112</li><li><strong>Mentally Aware Nigeria (MANI):</strong> 0809 210 6493</li><li><strong>Suicide Research and Prevention Initiative (SURPIN):</strong> 0806 210 6493, 0809 210 6493</li><li><strong>Lagos State Domestic and Sexual Violence Agency:</strong> 0813 796 0048</li></ul><h2>What to expect</h2><ul><li>Pick up the phone: Dial the number that matches your situation. All calls are free.</li><li>Speak to a responder: A trained crisis responder will listen, assess and guide you to safety.</li><li>Your call is confidential: Crisis lines do not share your identity or details without your consent.</li><li>Stay on the line: If life is at immediate risk, call 112 and stay on the line until help arrives.</li></ul>`,
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-2.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T11:00:00.000Z",
    sourceModifiedAt: "2026-07-29T11:00:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000117",
    kind: "page",
    sourceId: 990018,
    slug: "faqs",
    canonicalPath: "/content/pages/faqs",
    title: "FAQs",
    excerptHtml:
      "<p>Answers to common questions about Talk Space counselling, bookings, privacy and fees.</p>",
    bodyHtml:
      "<h2>Frequently asked questions</h2><p>These answers help you understand how Talk Space works and what to expect when you book counselling with us.</p><h3>Need more help?</h3><p>If your question is not answered here, contact us and we will respond within one working day.</p>",
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-1.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T11:10:00.000Z",
    sourceModifiedAt: "2026-07-29T11:10:00.000Z",
    sourceStatus: "publish",
  },
  {
    id: "20000000-0000-4000-8000-000000000118",
    kind: "page",
    sourceId: 990019,
    slug: "cancellation-refund-policy",
    canonicalPath: "/content/pages/cancellation-refund-policy",
    title: "Cancellation & refund policy",
    excerptHtml:
      "<p>How cancellations, rescheduling and refunds work for Talk Space counselling sessions.</p>",
    bodyHtml: `<h2>Cancellation and refund policy</h2><p>We hold your therapist's time exclusively for you. Please give at least 24 hours notice to reschedule without charge. Later changes may incur a fee.</p><h2>More than 24 hours before</h2><p>No charge for rescheduling.</p><h2>12 to 24 hours before</h2><p>50% of the session fee may apply.</p><h2>Less than 12 hours before, or no-show</h2><p>A full fee may apply unless there is an emergency.</p><h2>Refunds on plans</h2><p>For multi-session plans, unused sessions are refundable within 60 days of purchase, pro-rated at the single-session rate. Refunds are processed within 7 working days to the original payment method.</p><h2>Group cohorts</h2><p>Group fees are refundable in full up to 7 days before the cohort begins. After that, we can transfer your place to the next cohort but cannot refund the fee, as facilitator time and materials are committed.</p><h2>Ask us anything</h2><p>If a fee has been applied that you'd like to discuss, please email hello@talkspace.ng or contact us. We review every request individually.</p>`,
    authorName: "Talk Space",
    featuredMediaPath: "demo/hero-2.jpg",
    metadata: {
      template: "default",
    },
    publishedAt: "2026-07-29T11:20:00.000Z",
    sourceModifiedAt: "2026-07-29T11:20:00.000Z",
    sourceStatus: "publish",
  },
];

const SEEDED_PUBLIC_PAGE_SLUGS = [
  "about",
  "services",
  "pricing",
  "contact",
  "privacy-policy",
  "terms",
  "emergency-support",
  "faqs",
  "cancellation-refund-policy",
];

async function verifySeededPublicPages() {
  const { data, error } = await supabase
    .from("content_entries")
    .select("slug")
    .in("slug", SEEDED_PUBLIC_PAGE_SLUGS)
    .eq("kind", "page")
    .eq("source_status", "publish");

  if (error) throw error;

  const foundSlugs = new Set(data?.map((row) => row.slug) ?? []);
  const missing = SEEDED_PUBLIC_PAGE_SLUGS.filter((slug) => !foundSlugs.has(slug));

  if (missing.length > 0) {
    throw new Error(`Seed verification failed: missing public page entries: ${missing.join(", ")}`);
  }

  console.log(`Verified seeded public pages: ${SEEDED_PUBLIC_PAGE_SLUGS.join(", ")}`);
}

const demoSiteSettings = [
  {
    key: "site_details",
    value: defaultSiteDetails,
  },
  {
    key: "home_hero",
    value: {
      eyebrow: "Demo content pack",
      headingBefore: "A calmer website",
      headingEmphasis: "ready for testing",
      description:
        "Use these sample assets and copy to test the homepage hero, carousel, testimonials, and content editor.",
      primaryCtaLabel: "Book a demo session",
      secondaryCtaLabel: "Edit this hero",
      imageOnePath: "demo/hero-1.jpg",
      imageOneAlt: "Therapist and client in a calm demo session",
      imageTwoPath: "demo/hero-2.jpg",
      imageTwoAlt: "Counselling conversation with warm lighting",
    },
  },
  {
    key: "home_specialties",
    value: [
      {
        title: "Individual Therapy",
        alt: "Individual therapy in a calm counselling setting.",
        imageUrl: "demo/carousel-1.jpg",
      },
      {
        title: "Couples Counselling",
        alt: "Couples therapy in a peaceful shared space.",
        imageUrl: "demo/carousel-2.jpg",
      },
      {
        title: "Trauma Support",
        alt: "Trauma-informed therapy support.",
        imageUrl: "demo/carousel-3.webp",
      },
      {
        title: "Family Sessions",
        alt: "A family support conversation in a warm room.",
        imageUrl: "demo/hero-2.jpg",
      },
    ],
  },
  {
    key: "google_reviews",
    value: {
      label: "on Google",
      rating: 4.9,
      reviewCount: 128,
      reviewUrl: "https://www.google.com/maps/search/Talk+Space+Counselling+Services+reviews",
    },
  },
  {
    key: "home_sections",
    value: [
      { id: "hero", visible: true },
      { id: "carousel", visible: true },
      { id: "trust", visible: true },
      { id: "specialties", visible: true },
      { id: "therapists", visible: true },
      { id: "video", visible: true },
      { id: "how_it_works", visible: true },
      { id: "pricing", visible: true },
      { id: "reviews", visible: true },
      { id: "journal", visible: true },
      { id: "faq", visible: true },
      { id: "cta", visible: true },
    ],
  },
];

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function seedMedia(asset) {
  const bytes = await readFile(asset.fileUrl);
  const sha256 = hashBytes(bytes);
  const { error: uploadError } = await supabase.storage
    .from(mediaBucket)
    .upload(asset.storagePath, bytes, {
      upsert: true,
      contentType: asset.mimeType,
    });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("content_media").upsert(
    {
      source_hash: asset.sourceHash,
      storage_path: asset.storagePath,
      source_filename: asset.sourceFilename,
      mime_type: asset.mimeType,
      byte_size: bytes.length,
      sha256,
      alt_text: asset.altText,
      tags: asset.tags,
      metadata: {
        seeded_demo: true,
        source: "seed-demo-content",
        original_file: basename(asset.sourceFilename),
      },
    },
    { onConflict: "source_hash" },
  );
  if (error) throw error;

  return {
    ...asset,
    byteSize: bytes.length,
    sha256,
  };
}

async function upsertSiteSetting(setting) {
  const { error } = await supabase.from("site_settings").upsert(setting, { onConflict: "key" });
  if (error) throw error;
}

async function upsertTestimonial(row) {
  const { error } = await supabase.from("testimonials").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

async function upsertContentEntry(entry) {
  const { error } = await supabase.from("content_entries").upsert(
    {
      id: entry.id,
      kind: entry.kind,
      source_id: entry.sourceId,
      slug: entry.slug,
      canonical_path: entry.canonicalPath,
      title: entry.title,
      excerpt_html: entry.excerptHtml,
      body_html: entry.bodyHtml,
      source_status: entry.sourceStatus,
      published_at: entry.publishedAt,
      source_modified_at: entry.sourceModifiedAt,
      author_name: entry.authorName,
      featured_media_path: entry.featuredMediaPath,
      metadata: entry.metadata,
    },
    { onConflict: "kind,source_id" },
  );
  if (error) throw error;
}

async function linkContentMedia(entrySourceId, mediaPath) {
  const { data: entry, error: entryError } = await supabase
    .from("content_entries")
    .select("id")
    .eq("source_id", entrySourceId)
    .single();
  if (entryError) throw entryError;

  const { data: media, error: mediaError } = await supabase
    .from("content_media")
    .select("id")
    .eq("storage_path", mediaPath)
    .single();
  if (mediaError) throw mediaError;

  const { error } = await supabase.from("content_entry_media").upsert(
    {
      content_entry_id: entry.id,
      media_id: media.id,
      role: "featured",
      sort_order: 0,
    },
    { onConflict: "content_entry_id,media_id,role" },
  );
  if (error) throw error;
}

const mediaRows = [];
for (const asset of demoImages) {
  mediaRows.push(await seedMedia(asset));
  console.log(`Seeded media ${asset.storagePath}`);
}

for (const setting of demoSiteSettings) {
  await upsertSiteSetting(setting);
  console.log(`Seeded site setting ${setting.key}`);
}

for (const testimonial of demoTestimonials) {
  await upsertTestimonial(testimonial);
  console.log(`Seeded testimonial ${testimonial.authorName}`);
}

for (const entry of demoEntries) {
  await upsertContentEntry(entry);
  await linkContentMedia(entry.sourceId, entry.featuredMediaPath);
  console.log(`Seeded content entry ${entry.kind}:${entry.slug}`);
}

await verifySeededPublicPages();

console.log(
  `Done. ${mediaRows.length} media assets, ${demoSiteSettings.length} site settings, ${demoTestimonials.length} testimonials, and ${demoEntries.length} content entries are ready.`,
);
