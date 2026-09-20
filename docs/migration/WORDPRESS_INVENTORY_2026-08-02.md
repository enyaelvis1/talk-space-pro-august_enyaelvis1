# WordPress content and media inventory

Generated on **2026-08-02** from `https://www.talkspace.ng/wp-json/wp/v2`.

This is a metadata inventory for migration decisions. It deliberately stores content hashes and byte counts instead of duplicating full article bodies; the full July source snapshot remains in `supabase/migrations/20260715120000_talkspace_content_seed.sql`.

| Record type                                  | Count |
| -------------------------------------------- | ----: |
| Pages                                        |     9 |
| Posts                                        |    84 |
| Categories                                   |     7 |
| Public media records returned                |   179 |
| Media total reported by WordPress            |   182 |
| Media records not returned by the public API |     3 |
| Content records without featured media       |    11 |
| Media records without alt text               |    72 |

- Latest content modification: 2026-07-24T15:59:24
- Latest media modification: 2026-02-27T12:28:41
- Machine-readable inventory: [wordpress-inventory-2026-08-02.json](wordpress-inventory-2026-08-02.json)

## Usage

Refresh the inventory without importing or deleting anything:

```bash
node scripts/export-wordpress-inventory.mjs YYYY-MM-DD
```

Review this inventory with the content owner before selecting records for migration or removal.
