import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage critical images use responsive Supabase transformations", () => {
  const image = read("src/components/site/OptimizedImage.tsx");
  const home = read("src/routes/index.tsx");
  assert.match(image, /render\/image\/public/);
  assert.match(image, /render\/image\/sign/);
  assert.match(image, /srcSet=/);
  assert.match(image, /media="\(max-width: 640px\)"/);
  assert.match(image, /loading = "lazy"/);
  assert.match(image, /loading=\{loading\}/);
  assert.match(home, /fetchPriority=\{i === 0 \? "high" : "low"\}/);
  assert.match(home, /mobileResponsiveWidths=\{\[320, 480\]\}/);
  assert.match(home, /hidden w-full max-w-4xl sm:block/);
  assert.match(home, /bg-gradient-to-br from-brand-mint-soft/);
  assert.match(home, /getPublicHomepageData/);
});

test("public imagery and motion safeguards are covered across key pages", () => {
  const image = read("src/components/site/OptimizedImage.tsx");
  const gallery = read("src/components/site/AutoPlayGallery.tsx");
  const reveal = read("src/components/site/Reveal.tsx");
  const styles = read("src/styles.css");
  const routes = [
    "src/routes/index.tsx",
    "src/routes/services.tsx",
    "src/routes/about.tsx",
    "src/routes/therapists.tsx",
    "src/routes/blog.tsx",
    "src/routes/content.$kind.$slug.tsx",
  ];

  assert.match(image, /DEFAULT_RESPONSIVE_WIDTHS = \[480, 768, 1280\]/);
  assert.match(image, /mobileResponsiveWidths/);
  assert.match(image, /srcSet=\{transformed\.length \? transformed\.join\(", "\) : undefined\}/);
  assert.match(gallery, /responsiveWidths=\{\[320, 480, 720\]\}/);
  assert.match(gallery, /sizes="\(max-width: 640px\) 220px/);
  assert.match(reveal, /prefers-reduced-motion: reduce/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.reveal-on-scroll,[\s\S]*\.marquee-x/);
  assert.match(styles, /animation: none !important/);

  for (const route of routes) {
    const source = read(route);
    assert.match(source, /OptimizedImage|AutoPlayGallery/);
    assert.match(source, /sizes=/);
  }
});

test("public navigation exposes tested keyboard and screen-reader behavior", () => {
  const header = read("src/components/site/SiteHeader.tsx");
  const audit = read("scripts/audit-public-accessibility.mjs");
  assert.match(header, /Skip to content/);
  assert.match(header, /role="dialog"/);
  assert.match(header, /aria-modal="true"/);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(header, /inert=\{!open\}/);
  assert.match(header, /useBrowserAuthState/);
  assert.doesNotMatch(header, /window\.setInterval/);
  assert.match(header, /await supabase\.auth\.signOut\(\)/);
  assert.match(audit, /Accessibility\.getFullAXTree/);
  assert.match(audit, /wcag22aa/);
});

test("homepage shows only three therapists while therapists page stays complete", () => {
  const home = read("src/routes/index.tsx");
  const therapists = read("src/routes/therapists.tsx");

  assert.match(home, /const HOMEPAGE_THERAPIST_LIMIT = 3/);
  assert.match(home, /const featuredTherapists = therapists\.slice\(0, HOMEPAGE_THERAPIST_LIMIT\)/);
  assert.match(home, /featuredTherapists\.map/);
  assert.match(therapists, /therapists\.map/);
  assert.doesNotMatch(therapists, /HOMEPAGE_THERAPIST_LIMIT|slice\(0, 3\)/);
});

test("first-time client assessments stay on booking and manage pages", () => {
  const assessmentData = read("src/lib/first-time-assessments.ts");
  const assessments = read("src/components/site/FirstTimeAssessmentLinks.tsx");
  const booking = read("src/routes/book.tsx");
  const manage = read("src/routes/manage.$reference.tsx");

  assert.match(assessments, /First-time clients/);
  assert.match(assessments, /FIRST_TIME_ASSESSMENTS/);
  assert.match(assessments, /FIRST_TIME_ASSESSMENT_EMAIL/);
  assert.match(assessmentData, /https:\/\/www\.16personalities\.com\/free-personality-test/);
  assert.match(assessmentData, /https:\/\/forms\.gle\/wLvG382DiAA3by3u6/);
  assert.match(assessmentData, /https:\/\/forms\.gle\/QpsayjhkZA5UyMCS8/);
  assert.match(assessmentData, /therapist@talkspace\.ng/);
  assert.match(assessments, /Forward your 1st assessment result/);
  assert.match(booking, /<FirstTimeAssessmentLinks className="mt-6" \/>/);
  assert.match(manage, /<FirstTimeAssessmentLinks \/>/);
});

test("homepage video iframe avoids unsupported permission-policy features", () => {
  const home = read("src/routes/index.tsx");
  assert.match(
    home,
    /allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"/,
  );
  assert.doesNotMatch(home, /web-share/);
});

test("public cms pages lazy-load section editing dependencies", () => {
  const publicPage = read("src/components/site/EditablePublicPage.tsx");
  const editor = read("src/components/site/EditableSections.tsx");
  const sectionSettings = read("src/components/admin/SectionSettings.tsx");
  const viteConfig = read("vite.config.ts");

  assert.match(publicPage, /lazy\(\(\) => importEditor\(editorAttempt\)\)/);
  assert.match(publicPage, /import\("@\/components\/site\/EditableSections"\)/);
  assert.match(publicPage, /@vite-ignore/);
  assert.match(publicPage, /EditableSections\.tsx\?editor=\$\{Date\.now\(\)\}/);
  assert.match(publicPage, /EditorLoadBoundary/);
  assert.match(publicPage, /Retry editor/);
  assert.match(publicPage, /<SectionRenderer sections=\{sectionsToShow\} \/>/);
  assert.doesNotMatch(publicPage, /import \{ EditableSections \}/);
  assert.match(editor, /startInEditMode/);
  assert.match(editor, /window\.confirm/);
  assert.doesNotMatch(editor, /ConfirmDeleteSectionDialog/);
  assert.doesNotMatch(editor, /@\/components\/ui\/alert-dialog/);
  assert.doesNotMatch(editor, /@\/components\/ui\/dropdown-menu/);
  assert.doesNotMatch(sectionSettings, /@\/components\/ui\/select/);
  assert.doesNotMatch(sectionSettings, /@\/components\/ui\/switch/);
  assert.match(viteConfig, /@radix-ui\/react-alert-dialog/);
  assert.match(viteConfig, /@radix-ui\/react-checkbox/);
  assert.match(viteConfig, /@radix-ui\/react-dropdown-menu/);
  assert.match(viteConfig, /@radix-ui\/react-progress/);
  assert.match(viteConfig, /@radix-ui\/react-radio-group/);
  assert.match(viteConfig, /@radix-ui\/react-select/);
  assert.match(viteConfig, /@radix-ui\/react-switch/);
});

test("homepage loads inline editing tools after the visitor render path", () => {
  const home = read("src/routes/index.tsx");

  assert.match(home, /DeferredHomepageEditLayer/);
  assert.match(home, /import\("@\/components\/site\/HomepageEditLayer"\)/);
  assert.match(home, /hasLikelySignedInSession/);
  assert.match(home, /\^sb-\.\+-auth-token\$/);
  assert.match(home, /requestIdleCallback/);
  assert.doesNotMatch(home, /import \{ HomepageEditLayer/);
});

test("dev server refreshes optimized dependency cache for lazy public routes", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  const viteConfig = read("vite.config.ts");
  const booking = read("src/routes/book.tsx");

  assert.match(pkg.scripts?.dev ?? "", /vite dev --force/);
  assert.match(booking, /@\/components\/ui\/select/);
  assert.match(booking, /@\/components\/ui\/radio-group/);
  assert.match(viteConfig, /@radix-ui\/react-select/);
  assert.match(viteConfig, /@radix-ui\/react-radio-group/);
});

test("public SSR keeps its fallback when preview Supabase variables are absent", () => {
  const supabaseClient = read("src/integrations/supabase/client.ts");
  const contentFunctions = read("src/lib/content.functions.ts");
  const root = read("src/routes/__root.tsx");
  const appearance = read("src/components/site/SiteAppearance.tsx");
  assert.match(supabaseClient, /import\.meta\.env[\s\S]*process\.env/);
  assert.match(supabaseClient, /new Proxy\(/);
  assert.match(contentFunctions, /process\.env\.SUPABASE_URL/);
  assert.match(root, /loader: \(\) => getPublicShellData\(\)/);
  assert.match(root, /--site-background/);
  assert.doesNotMatch(appearance, /getPublicSiteDetails\(/);
});

test("about page fallback keeps the refreshed inner-page composition", () => {
  const about = read("src/routes/about.tsx");
  assert.match(about, /OptimizedImage/);
  assert.match(about, /teamSessionImg/);
  assert.match(about, /ABOUT_STORY_IMAGE_SRC/);
  assert.match(about, /conversationImg/);
  assert.match(about, /aboutStorySection/);
  assert.match(about, /b17cf861-9ef993a5/);
  assert.match(about, /Talk Space therapist seated in a counselling room/);
  assert.match(about, /LEGACY_ABOUT_INTRO_SECTION_ID/);
  assert.match(about, /hero-msp79f5r-u4nmvl/);
  assert.match(about, /Built in Lagos\. Made for anywhere you are\./);
  assert.match(about, /Talk Space began in 2017/);
  assert.match(about, /2017/);
  assert.match(about, /Gbagada, Lagos/);
  assert.match(about, /Explore services/);
  assert.match(about, /Talk to the care team/);
});

test("pricing page exposes the billing FAQ in CMS and fallback content", () => {
  const pricing = read("src/routes/pricing.tsx");
  const seed = read("src/lib/page-seed-content.ts");
  const renderer = read("src/components/site/sections/SectionRenderer.tsx");
  const migration = read("supabase/migrations/20260813083000_pricing_billing_faq_section.sql");

  assert.match(pricing, /pricingFaqSection/);
  assert.match(pricing, /ensurePricingFaq/);
  assert.match(seed, /id: "pricing-faq"/);
  assert.match(renderer, /isPricingFaq/);
  assert.match(renderer, /lg:grid-cols-\[1fr_1\.4fr\]/);
  assert.match(migration, /'id', 'pricing-faq'/);
  assert.match(migration, /'question', 'When is payment taken\?'/);
  assert.match(migration, /'question', 'Can I book a package rather than pay per session\?'/);
});

test("pricing card CTAs render as highlighted buttons in CMS content", () => {
  const renderer = read("src/components/site/sections/SectionRenderer.tsx");

  assert.match(renderer, /const isPricingCardGrid = section\.id\.startsWith\("pricing-"\)/);
  assert.match(renderer, /variant: isPricingCardGrid \? "terracotta" : "link"/);
  assert.match(renderer, /size=\{isPricingCardGrid \? "pill" : "lg"\}/);
  assert.match(renderer, /w-full shadow-soft-warm sm:w-auto/);
});

test("public FAQ accordions render html inside the content wrapper", () => {
  const faqs = read("src/routes/faqs.tsx");
  const liveSections = read("src/components/site/sections/LiveSections.tsx");

  assert.doesNotMatch(faqs, /<AccordionContent[^>]*dangerouslySetInnerHTML/);
  assert.doesNotMatch(liveSections, /<AccordionContent[^>]*dangerouslySetInnerHTML/);
  assert.match(
    faqs,
    /<AccordionContent className="text-muted-foreground">\s*<div dangerouslySetInnerHTML=\{\{ __html: item\.a \}\} \/>/,
  );
  assert.match(
    liveSections,
    /<AccordionContent className="text-muted-foreground">\s*<div dangerouslySetInnerHTML=\{\{ __html: item\.answer \}\} \/>/,
  );
});

test("public FAQ data is deduped before rendering", () => {
  const contentFunctions = read("src/lib/content.functions.ts");
  const faqs = read("src/routes/faqs.tsx");
  const liveSections = read("src/components/site/sections/LiveSections.tsx");

  assert.match(contentFunctions, /function uniquePublicFaqs/);
  assert.match(contentFunctions, /normalizeFaqKey/);
  assert.match(contentFunctions, /return uniquePublicFaqs\(\(data \?\? \[\]\) as PublicFaq\[\]\)/);
  assert.match(faqs, /listPublicFaqs/);
  assert.match(liveSections, /listPublicFaqs/);
});

test("dark CMS callout sections use a defined light foreground color", () => {
  const renderer = read("src/components/site/sections/SectionRenderer.tsx");

  assert.match(renderer, /bg-brand-deep px-8 py-12 text-primary-foreground/);
  assert.match(renderer, /display-2 mt-3 text-primary-foreground/);
  assert.match(renderer, /text-primary-foreground\/70/);
  assert.match(renderer, /text-primary-foreground\/85/);
  assert.doesNotMatch(renderer, /text-brand-cream/);
});

test("journal cards expose the whole card as one article link", () => {
  const blog = read("src/routes/blog.tsx");
  const cardBlock = blog.slice(blog.indexOf("{posts.map"), blog.indexOf("{posts.length === 0"));

  assert.match(
    blog,
    /Reflections on[\s\S]*<span className="italic text-accent-terracotta">[\s\S]*mental health, marriage & healing[\s\S]*<\/span>[\s\S]*\./,
  );
  assert.match(blog, /Outlet, useRouterState/);
  assert.match(blog, /pathname !== "\/blog"/);
  assert.match(blog, /return <Outlet \/>/);
  assert.match(blog, /function BlogIndex\(\)/);
  assert.match(cardBlock, /to="\/blog\/\$slug"/);
  assert.equal((cardBlock.match(/<Link/g) ?? []).length, 1);
  assert.match(cardBlock, /className="flex h-full flex-col/);
  assert.match(cardBlock, /aria-label=\{`Read \$\{p\.title\}`\}/);
  assert.match(cardBlock, /<span className="mt-5 inline-flex[\s\S]*Read the essay/);
  assert.doesNotMatch(cardBlock, /<h2[\s\S]*<Link/);
});

test("journal cards can use imported body images when featured media is empty", () => {
  const contentFunctions = read("src/lib/content.functions.ts");
  const publicPostSelects = contentFunctions.match(
    /\.select\(\s*"id, kind, slug, title, excerpt_html, body_html, author_name, published_at, featured_media_path, metadata/g,
  );

  assert.match(
    contentFunctions,
    /function firstPostImageUrl\(bodyHtml: string, supabaseUrl: string\)/,
  );
  assert.match(contentFunctions, /function isBrandPostImage\(src: string\)/);
  assert.match(contentFunctions, /isBrandPostImage\(src\)/);
  assert.match(contentFunctions, /firstPostImageUrl\(bodyHtml, supabaseUrl\)/);
  assert.ok((publicPostSelects ?? []).length >= 2);
});

test("journal article pages expose a direct admin editor entry point", () => {
  const article = read("src/routes/blog.$slug.tsx");
  const editLayer = read("src/components/site/AdminPageEditLayer.tsx");
  const contentFunctions = read("src/lib/content.functions.ts");
  const adminFunctions = read("src/lib/admin.functions.ts");

  assert.match(article, /AdminPageEditLayer/);
  assert.match(article, /editorPath=\{`\/admin\/content\/\$\{post\.id\}\/edit`\}/);
  assert.match(article, /editButtonLabel="Edit this post"/);
  assert.match(editLayer, /editButtonLabel = "Edit this page"/);
  assert.match(editLayer, /<a href=\{editorPath\}>/);
  assert.match(contentFunctions, /cleanLegacyPostBodyHtml\(entry\.body_html\)/);
  assert.match(adminFunctions, /cleanLegacyPostBodyHtml\(rawBodyHtml\)/);
});
