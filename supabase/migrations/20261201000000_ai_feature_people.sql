-- Who changed an AI feature, by email (#453, part of #430 T6; decision AI-PAGE-EDIT). The AI
-- feature pages show who changed a status and who last saved (a) to (c) as the admin shows people
-- elsewhere (ADM-12 Publish history, list_publish_history): by email. The tables of
-- 20261130000000_ai_features.sql keep only the account id (changed_by, sections_updated_by), and
-- the email is in auth.users, which no API role can read. This function returns the email of each
-- account named in one feature's status history or as its last editor, to content editors only.
--
-- It adds one read function and changes no table, row, policy or other function. Running this file
-- a second time stops with an error (the function exists) and changes nothing.

create function public.list_ai_feature_people(target_feature text)
returns table (
  user_id uuid,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may read who changed an AI feature' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text
  from auth.users u
  where u.id in (
    select h.changed_by
    from public.ai_feature_status_history h
    where h.feature_slug = target_feature and h.changed_by is not null
    union
    select f.sections_updated_by
    from public.ai_features f
    where f.slug = target_feature and f.sections_updated_by is not null
  );
end;
$$;

revoke all on function public.list_ai_feature_people(text) from public, anon, authenticated;
grant execute on function public.list_ai_feature_people(text) to authenticated;
