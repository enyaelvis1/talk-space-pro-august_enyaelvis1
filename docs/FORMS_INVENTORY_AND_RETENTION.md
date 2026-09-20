# Talk Space forms inventory and retention decision

This is the working inventory for the Forms and secure intake checklist item:
“Inventory existing Google Forms and decide which are retained.”

The current repo and imported content do not expose any active Google Forms URL.
The product decision is final: all intake forms are handled in-app, and admin
records are shown in the app. There is no retained Google Forms workflow in the
current product.

## Retained forms

| Form                              | Route / location                         | Purpose                                         | Retention decision |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------- | ------------------ |
| Booking intake form               | `/book`                                  | Primary confidential session request flow       | Keep               |
| Contact form                      | `/contact`                               | General enquiries and support requests          | Keep               |
| Admin client intake-style records | `/admin/clients` and client detail views | Secure internal review of submitted information | Keep               |

## Legacy / replace

| Legacy form type                     | Evidence in repo                                                      | Decision                            |
| ------------------------------------ | --------------------------------------------------------------------- | ----------------------------------- |
| Google Forms used by the old website | No active URL found in the current repository or imported app content | Not retained; use in-app forms only |

## Working decision

- Keep the booking flow in the app.
- Keep the contact form in the app.
- Keep all secure intake and admin review records in the app.
- There is no Google Forms route to preserve in this implementation.

## Follow-up needed

- None for Google Forms. The remaining work is internal form evolution and
  secure intake maintenance inside the app.
