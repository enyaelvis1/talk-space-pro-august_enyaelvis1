drop policy if exists availability_exceptions_admin_read on public.availability_exceptions;
drop policy if exists availability_exceptions_admin_insert on public.availability_exceptions;
drop policy if exists availability_exceptions_admin_delete on public.availability_exceptions;

create policy availability_exceptions_admin_read on public.availability_exceptions for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy availability_exceptions_admin_insert on public.availability_exceptions for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy availability_exceptions_admin_delete on public.availability_exceptions for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
grant insert, delete on public.availability_exceptions to authenticated;
