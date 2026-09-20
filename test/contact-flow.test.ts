import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const talkspace = await readFile(new URL("../src/lib/talkspace.ts", import.meta.url), "utf8");
const contactRoute = await readFile(new URL("../src/routes/contact.tsx", import.meta.url), "utf8");
const storeLocator = await readFile(
  new URL("../src/components/site/StoreLocatorMap.tsx", import.meta.url),
  "utf8",
);
const contactFunctions = await readFile(
  new URL("../src/lib/contact.functions.ts", import.meta.url),
  "utf8",
);
const securityHeaders = await readFile(
  new URL("../src/lib/security-headers.ts", import.meta.url),
  "utf8",
);
const locatorHtml = await readFile(
  new URL("../public/store-locator/locator-plus.html", import.meta.url),
  "utf8",
);
const contactForm = await readFile(
  new URL("../src/components/site/ContactEnquiryForm.tsx", import.meta.url),
  "utf8",
);
const adminEmailsRoute = await readFile(
  new URL("../src/routes/_authenticated.admin.emails.tsx", import.meta.url),
  "utf8",
);
const adminMessagesRoute = await readFile(
  new URL("../src/routes/_authenticated.admin.messages.tsx", import.meta.url),
  "utf8",
);
const adminClientFunctions = await readFile(
  new URL("../src/lib/clients.functions.ts", import.meta.url),
  "utf8",
);

test("locator applies the approved Lagos name without changing other office details", async () => {
  const script = locatorHtml.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  for (const reversed of [false, true]) {
    const lagos = {
      placeId: "ChIJj3SFRuaNOxARxdxE2VFox40",
      title: "Talk Space Counselling",
      address1: "Existing address",
      coords: { lat: 6.6, lng: 3.34 },
      actions: [{ defaultUrl: "https://paystack.shop/tscs" }],
    };
    const abuja = { placeId: "abuja", title: "Talk Space Counselling Services, Abuja" };
    const configuration = { locations: reversed ? [lagos, abuja] : [abuja, lagos] };
    let ready;
    let rendered;
    runInNewContext(script, {
      CONFIGURATION: configuration,
      customElements: { whenDefined: async () => {} },
      document: {
        addEventListener: (_, callback) => {
          ready = callback;
        },
        querySelector: (selector) =>
          selector === "gmpx-api-loader"
            ? { setAttribute() {} }
            : {
                configureFromQuickBuilder: (value) => {
                  rendered = value;
                },
              },
      },
    });
    await ready();
    assert.equal(rendered, configuration);
    assert.equal(lagos.title, "Talk Space Counseling, Lagos");
    assert.equal(abuja.title, "Talk Space Counselling Services, Abuja");
    assert.equal(lagos.address1, "Existing address");
    assert.deepEqual(lagos.coords, { lat: 6.6, lng: 3.34 });
    assert.equal(lagos.actions[0].defaultUrl, "/book");
  }
});

test("contact page keeps the public enquiry form and WhatsApp entry points visible", () => {
  assert.match(contactRoute, /A calm place to/);
  assert.match(contactRoute, /Open in WhatsApp/);
  assert.match(contactRoute, /afterSections=\{<StoreLocatorMap \/>/);
  assert.match(contactRoute, /<StoreLocatorMap \/>/);
  assert.match(storeLocator, /\/store-locator\/locator-plus\.html/);
  assert.match(storeLocator, /title="Talk Space store locator"/);
  assert.match(locatorHtml, /https:\/\/paystack\.shop\/tscs/);
  assert.match(locatorHtml, /action\.defaultUrl = "\/book"/);
  assert.match(securityHeaders, /https:\/\/ajax\.googleapis\.com/);
  assert.match(securityHeaders, /https:\/\/maps\.googleapis\.com/);
  assert.match(securityHeaders, /https:\/\/storage\.googleapis\.com/);
  assert.match(contactForm, /Send message/);
  assert.match(contactForm, /We reply within one working day/);
  assert.match(talkspace, /whatsapp:\s*"\+234 704 846 9090"/);
  assert.match(talkspace, /WHATSAPP_MESSAGE/);
  assert.match(talkspace, /I'd like to ask about booking a session/);
  assert.match(talkspace, /WHATSAPP_HREF/);
});

test("contact submissions are protected, stored, and shown to admins", () => {
  assert.match(contactFunctions, /website && data\.website\.length > 0/);
  assert.match(contactFunctions, /Too many messages from this device/);
  assert.match(contactFunctions, /contact_submissions/);
  assert.match(contactFunctions, /intake_submissions/);
  assert.match(contactFunctions, /ack_sent_at/);
  assert.match(contactFunctions, /admin_notified_at/);
  assert.match(contactFunctions, /delivery_error/);
  assert.match(contactFunctions, /settings\.zohoRoutingEnabled/);
  assert.match(contactFunctions, /routingProvider: settings\.zohoRoutingEnabled \? "zoho_mail"/);
  assert.match(adminEmailsRoute, /Zoho recipient inbox/);
  assert.match(adminEmailsRoute, /Route contact submissions to Zoho Mail/);
  assert.doesNotMatch(adminEmailsRoute, /listContactSubmissions/);
  assert.doesNotMatch(adminEmailsRoute, /Contact submissions/);
  assert.match(adminMessagesRoute, /Contact messages/);
  assert.match(adminMessagesRoute, /listContactSubmissions/);
  assert.match(adminMessagesRoute, /deleteContactSubmission/);
  assert.match(adminMessagesRoute, /Client acknowledgement/);
  assert.match(adminMessagesRoute, /Admin notice/);
  assert.match(adminClientFunctions, /contact_submissions/);
  assert.match(adminClientFunctions, /ackSentAt/);
  assert.match(adminClientFunctions, /adminNotifiedAt/);
});

test("admins have published response and privacy guidance beside enquiries", () => {
  assert.match(adminEmailsRoute, /Administrator response guidance/);
  assert.match(adminEmailsRoute, /Urgent safety concern/);
  assert.match(adminEmailsRoute, /Same business day/);
  assert.match(adminEmailsRoute, /Within one working day/);
  assert.match(adminEmailsRoute, /Verify identity before sharing booking or payment details/);
});
