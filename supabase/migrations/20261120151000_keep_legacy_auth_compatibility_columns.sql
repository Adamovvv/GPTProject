-- Compatibility for the currently deployed username-auth Edge Function.
-- These flags are inert: all email verification triggers and the contact-email table are removed.
alter table public.profiles
  add column if not exists email_verification_required boolean not null default false,
  add column if not exists email_verified_at timestamptz;
