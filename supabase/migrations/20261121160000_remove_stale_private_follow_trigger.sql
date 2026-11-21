-- Remove the legacy privacy trigger that referenced the retired kyro_profile_settings table.
-- Current private-profile approval is enforced by kyro_follow_requests and
-- kyro_reject_blocked_social_interaction; this trigger is obsolete.
drop trigger if exists kyro_guard_private_follow on public.social_follows;
drop function if exists public.kyro_guard_private_follow();
