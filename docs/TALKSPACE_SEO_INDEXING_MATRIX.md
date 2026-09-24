# Talk Space SEO and indexing ownership matrix

Reviewed: 24 September 2026

This is the repository-side indexing policy. Search Console submission and
coverage monitoring remain external operational responsibilities.

| Route/content | Index? | Canonical policy | Sitemap? | Owner/action |
| --- | --- | --- | --- | --- |
| `/`, `/services`, `/therapists`, `/pricing`, `/about`, `/blog`, `/contact`, `/faqs` | Yes | `canonicalUrl(path)` | Yes | Content/product owner reviews published copy |
| `/emergency-support`, `/privacy-policy`, `/terms`, `/cancellation-refund-policy` | Yes | Route canonical | Yes | Product/legal owner reviews content |
| Published CMS pages/posts | Yes when public and published | CMS canonical path through `pageSeoHead`/post SEO | Yes | CMS owner publishes and checks metadata |
| Draft/archived/unpublished CMS entries | No | Never expose as public canonical content | No | CMS owner |
| `/admin/**` | No | Route-level `noindex, nofollow` | No | Engineering |
| `/account/**`, `/therapist/**` | No | Route-level private canonical/noindex | No | Engineering |
| `/book/payment-callback`, `/manage/**`, payment/recovery/token URLs | No | Tokenized/private flow; noindex | No | Engineering |
| `/robots.txt` | N/A | References `${SITE_URL}/sitemap.xml` | N/A | Engineering owns route; Search Console owner submits |
| `/sitemap.xml` | N/A | Absolute `https://talkspace.ng` URLs only | N/A | Engineering owns generation |

## Release checks

- Fetch `/robots.txt` and `/sitemap.xml` from the reviewed staging revision.
- Confirm private, tokenized, admin, account, and therapist routes are absent.
- Confirm only published CMS content appears and every URL returns the expected
  public status before submitting the sitemap.
- Confirm public pages emit one canonical URL and that CMS SEO fields cannot
  turn private routes into indexable routes.
- The organization’s Search Console owner must submit and monitor the sitemap;
  no repository code stores Search Console credentials or performs submission.
