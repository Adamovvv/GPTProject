-- Remove all KYRO email verification requirements and private contact-email storage.
drop trigger if exists kyro_require_verified_email_community on public.kyro_communities;
drop trigger if exists kyro_require_verified_email_community_member on public.kyro_community_members;
drop trigger if exists kyro_require_verified_email_community_post on public.kyro_community_posts;
drop trigger if exists kyro_require_verified_email_market on public.market_listings;
drop trigger if exists kyro_guard_email_verification_fields on public.profiles;
drop trigger if exists kyro_require_verified_email_follow on public.social_follows;
drop trigger if exists kyro_require_verified_email_post on public.social_posts;
drop trigger if exists kyro_require_verified_email_social_like on public.social_likes;
drop function if exists private.kyro_require_verified_email();
drop function if exists private.kyro_require_verified_email_for_market_and_communities();
drop function if exists private.kyro_require_verified_email_for_social_like();
drop function if exists private.kyro_guard_email_verification_fields();
alter table public.profiles drop column if exists email_verification_required, drop column if exists email_verified_at;
drop table if exists public.kyro_user_emails;
