create or replace function public.log_section_audit(p_entry_id uuid, p_ops jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_count int := 0;
  v_op jsonb;
  v_action text;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin'::app_role) then
    raise exception 'Not authorized to record section audit entries';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  for v_op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    v_action := 'section.' || coalesce(nullif(v_op->>'op', ''), 'update');
    insert into public.admin_audit_logs (
      actor_id, actor_email, actor_kind, action, target_type, target_id, reason, changed_fields
    ) values (
      v_uid,
      v_email,
      'admin',
      v_action,
      'content_section',
      p_entry_id::text,
      coalesce(nullif(v_op->>'reason', ''), 'Section change'),
      coalesce(
        (select array_agg(f) from jsonb_array_elements_text(coalesce(v_op->'fields', '[]'::jsonb)) as t(f)),
        '{}'::text[]
      )
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.log_section_audit(uuid, jsonb) to authenticated;
grant execute on function public.log_section_audit(uuid, jsonb) to service_role;