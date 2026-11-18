create or replace function private.kyro_ensure_vapid_keys(p_public text,p_private text)
returns table(public_key text,private_key text)
language plpgsql security definer set search_path=''
as $$
declare v_role text:=current_setting('request.jwt.claim.role',true); v_public text; v_private text; v_id uuid;
begin
 if v_role is distinct from 'service_role' then raise exception 'Service role required'; end if;
 perform pg_advisory_xact_lock(hashtext('kyro-vapid-keys'));
 select decrypted_secret into v_public from vault.decrypted_secrets where name='kyro_vapid_public_key' limit 1;
 select decrypted_secret into v_private from vault.decrypted_secrets where name='kyro_vapid_private_key' limit 1;
 if v_public is null or v_private is null then
  if v_public is null then perform vault.create_secret(p_public,'kyro_vapid_public_key','KYRO Web Push VAPID public key');
  else select id into v_id from vault.decrypted_secrets where name='kyro_vapid_public_key' limit 1; perform vault.update_secret(v_id,p_public); end if;
  if v_private is null then perform vault.create_secret(p_private,'kyro_vapid_private_key','KYRO Web Push VAPID private key');
  else select id into v_id from vault.decrypted_secrets where name='kyro_vapid_private_key' limit 1; perform vault.update_secret(v_id,p_private); end if;
 end if;
 return query select
  (select decrypted_secret from vault.decrypted_secrets where name='kyro_vapid_public_key' limit 1),
  (select decrypted_secret from vault.decrypted_secrets where name='kyro_vapid_private_key' limit 1);
end;
$$;
create or replace function public.kyro_ensure_vapid_keys(p_public text,p_private text)
returns table(public_key text,private_key text)
language sql security definer set search_path=''
as $$ select * from private.kyro_ensure_vapid_keys(p_public,p_private); $$;
revoke all on function public.kyro_ensure_vapid_keys(text,text) from public,anon,authenticated;
grant execute on function public.kyro_ensure_vapid_keys(text,text) to service_role;
