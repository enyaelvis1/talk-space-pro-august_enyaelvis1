-- Add a dedicated role for therapist dashboard access. Therapist data remains
-- server-mediated; this only lets role checks distinguish therapist users.

alter type public.app_role add value if not exists 'therapist';
