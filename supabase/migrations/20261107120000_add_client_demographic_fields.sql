-- Extend admin-managed client profiles with requested demographic fields.
-- These remain optional and free-form to preserve imported client values.

alter table public.clients
  add column if not exists gender text,
  add column if not exists religion text,
  add column if not exists marital_status text;
