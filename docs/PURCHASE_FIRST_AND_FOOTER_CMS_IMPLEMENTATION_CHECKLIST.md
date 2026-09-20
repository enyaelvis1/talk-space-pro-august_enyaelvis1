# Purchase-first and footer CMS implementation checklist

Scope: complete BPC-001/BPC-002 and make every footer-owned field editable from the admin CMS.

## Purchase-first checkout

- [x] Add a public purchase-first route that does not create an appointment or reserve a slot.
- [x] Require a service so purchased credit has an enforceable service boundary.
- [x] Keep session mode, preferred date and preferred time optional during purchase.
- [x] Allow clients to choose between 1 and 50 sessions.
- [x] Calculate the unit session price from the configured service bundle price.
- [x] Apply the configured in-person price when in-person mode is selected.
- [x] Create a package-purchase payment that is not linked to an appointment.
- [x] Activate exactly one unused package after verified successful payment.
- [x] Keep payment confirmation idempotent so repeated verification cannot duplicate credit.
- [x] Return the secure package booking link on the payment confirmation page.
- [x] Email the secure package booking link after successful verification.
- [x] Preserve optional mode/date/time preferences in payment metadata.
- [ ] Apply the database migrations to staging.
- [ ] Complete staging Paystack UAT and attach evidence.

## Multiple purchases and balances

- [x] Support multiple sessions in one purchase.
- [x] Support repeated purchases as separate, independently auditable package records.
- [x] Start purchase-first packages with zero used sessions.
- [x] Consume package credit transactionally during later booking.
- [x] Prevent a payment callback from creating duplicate package credit.
- [ ] Confirm repeated purchases and later balance consumption on staging.

## Footer CMS

- [x] Store footer crisis content, description, navigation, office locations and bottom text in `site_settings`.
- [x] Store both Abuja and Lagos office locations as structured records.
- [x] Preserve existing administrator content when the seed adds missing footer fields.
- [x] Add admin controls to add, edit and remove office locations.
- [x] Continue sourcing brand, logo, email, telephone, WhatsApp, opening hours and social links from editable site details.
- [x] Render structured office locations in the public footer.
- [ ] Apply the footer seed migration to staging.
- [ ] Verify every footer field from admin edit through public rendering on staging.

## Verification gate

- [x] Formatting passes for changed source and documentation files.
- [x] Lint passes with seven existing Fast Refresh warnings and no errors.
- [x] Purchase migration and focused payment/public-shell tests pass.
- [x] Production build passes.
- [x] Purchase-first browser checks pass at desktop and 390 x 844 mobile viewports.
- [ ] Staging UAT passes before production promotion.
