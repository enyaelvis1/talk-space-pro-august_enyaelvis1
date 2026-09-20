-- Historical reset snapshot intentionally disabled.
-- This migration previously dropped and recreated the public schema, which is
-- unsafe after the canonical July 15 migrations have already been applied.

select 1;
