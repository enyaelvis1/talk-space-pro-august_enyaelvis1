# Legacy URL inventory

Generated on **2026-08-02** from the live WordPress sitemap and the dated REST inventory.

| URL class                              | Count |
| -------------------------------------- | ----: |
| Unique URLs                            |   458 |
| Sitemap URLs                           |    96 |
| Content URLs                           |   100 |
| Media attachment pages                 |   179 |
| Direct media assets                    |   179 |
| Reachable now                          |   229 |
| Redirected to a different URL          |     0 |
| Verification rate-limited by WordPress |   228 |
| Confirmed unreachable or errored       |     1 |

- Sitemap index: https://www.talkspace.ng/sitemap_index.xml
- WordPress inventory: `docs/migration/wordpress-inventory-2026-08-02.json`
- Machine-readable inventory: [legacy-url-inventory-2026-08-02.json](legacy-url-inventory-2026-08-02.json)
- Review spreadsheet: [legacy-url-inventory-2026-08-02.csv](legacy-url-inventory-2026-08-02.csv)

## Scope

The inventory merges every URL published in the WordPress page, post, and category sitemaps with content, media attachment, and direct media asset URLs returned by the REST inventory. Duplicate and trailing-slash variants are normalized. HTTP status and final destination were checked without modifying the source site.

Use the admin **Content migration** screen for approval decisions. A URL being reachable or currently published does not make it approved for migration or deletion.
