# Talk Space form templates and versioning

This is the working template registry for the Forms and secure intake backlog
item: “Create versioned form templates.”

The intent is to keep the form structure stable, auditable, and easy to evolve
without breaking existing submissions.

## Versioning rules

- Use a stable template key plus a version suffix: `*_v1`, `*_v2`, etc.
- Increment the version when a change alters the meaning, order, or required
  nature of questions.
- Keep non-breaking copy tweaks inside the same version when they do not affect
  stored submission data.
- Every submission must store the template key and version that rendered it.
- New versions should not overwrite old ones; they should coexist so staff can
  still review historic submissions against the exact question set the client
  saw.
- Secure intake rows now store `template_key` and `template_version` together
  so the admin history can display the exact version captured at submission
  time.

## Current template registry

| Template key              | Status            | Backed experience    | Purpose                                    |
| ------------------------- | ----------------- | -------------------- | ------------------------------------------ |
| `booking_intake_v1`       | Active            | `/book`              | Confidential appointment request           |
| `contact_enquiry_v1`      | Active            | `/contact`           | General contact and support enquiry        |
| `client_profile_v1`       | Active internally | Admin client records | Staff-facing client intake and review data |
| `assessment_wellbeing_v1` | Approved internal | Admin client records | Light-touch wellbeing screening            |
| `assessment_readiness_v1` | Approved internal | Admin client records | Matching and scheduling readiness review   |

## Booking intake template: `booking_intake_v1`

Current fields:

- Full name
- Email
- Phone
- Service
- Session mode
- Preferred date
- Preferred time
- Notes

Rules:

- Keep the service and date fields required.
- Keep the notes field optional or lightly constrained.
- Preserve the booking reference and appointment state with the submission.

## Contact enquiry template: `contact_enquiry_v1`

Current fields:

- Full name
- Email
- Phone
- Message
- Website honeypot / anti-spam field

Rules:

- Keep the message field required.
- Preserve sender metadata and source for admin review and reply tracking.
- Store acknowledgement state separately from the original submission.

## Internal client profile template: `client_profile_v1`

Current fields:

- Full name
- Email
- Phone
- Assigned therapist
- Notes / care summary
- Related bookings and payments

Rules:

- This template is internal and should not be exposed as a public form.
- Preserve staff-only edits with revision history.

## Approved assessment templates

Current approved assessment forms:

- `assessment_wellbeing_v1`
- `assessment_readiness_v1`

Rules:

- Keep assessment forms internal unless the care team explicitly approves a public flow.
- Preserve the exact template key/version on every saved assessment submission.
- Use the admin editor to adjust wording, question order, and approved options.

## Versioning examples

- Adding a new optional question to `/contact` that does not change storage can
  remain `contact_enquiry_v1`.
- Reordering required booking questions or adding a new required intake field
  should create `booking_intake_v2`.
- Introducing a new assessment flow should create its own template key, for
  example `assessment_psychotherapy_v1`, rather than overloading booking.

## Follow-up needed

- Build the admin question editor around these template keys.
- Use this registry when selecting approved assessment forms.
- Keep the in-app forms and admin review history as the sole intake path; no
  Google Forms workflow is retained.
