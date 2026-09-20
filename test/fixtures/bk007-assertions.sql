create function pg_temp.check_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end; $$;
insert into public.services(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.therapists(id) values ('22222222-2222-4222-8222-222222222222');
insert into public.therapist_services values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');
insert into public.availability_exceptions values ('22222222-2222-4222-8222-222222222222', '2035-01-01 10:00Z', '2035-01-01 12:00Z', 'online', 'added');
insert into public.appointments(booking_reference, client_id, therapist_id, service_id, starts_at, ends_at,
  hold_expires_at, manage_token_hash, manage_token)
values ('ACTIVE', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111', '2035-01-01 10:00Z', '2035-01-01 11:00Z', now()+interval '5 minutes', repeat('a',64), 'secret');
select pg_temp.check_true(public.appointment_manage_token_is_active(a), 'fresh token rejected') from public.appointments a where booking_reference='ACTIVE';
select pg_temp.check_true((select count(*)=1 from public.get_appointment_by_manage_token(repeat('a',64))), 'valid token lookup failed');
select pg_temp.check_true((select count(*)=0 from public.get_appointment_by_manage_token(repeat('f',64))), 'wrong token returned a booking');
select pg_temp.check_true(manage_token_expires_at = created_at+interval '5 minutes', 'checkout token too long') from public.appointments where booking_reference='ACTIVE';
insert into public.payments(appointment_id, reference, status, amount_kobo) select id, 'PAY-1', 'initiated', 10000 from public.appointments where booking_reference='ACTIVE';
update public.appointments set status='pending_payment' where booking_reference='ACTIVE';
select pg_temp.check_true(hold_expires_at is null and manage_token_expires_at = created_at+interval '5 minutes', 'pending extended expiry') from public.appointments where booking_reference='ACTIVE';
select public.mark_payment_status('PAY-1','succeeded');
select pg_temp.check_true(status='confirmed' and manage_token_expires_at=ends_at+interval '30 days' and public.appointment_manage_token_is_active(a), 'paid token not promoted') from public.appointments a where booking_reference='ACTIVE';
select pg_temp.check_true(not exists(select 1 from public.list_available_slots('11111111-1111-4111-8111-111111111111','2035-01-01','2035-01-01','online') where starts_at='2035-01-01 10:00Z'), 'paid slot available');
select pg_temp.check_true(not has_function_privilege('anon','public.mark_payment_status(text,public.payment_status,text,text,jsonb)','EXECUTE'), 'anon can confirm payment');
select pg_temp.check_true(not has_function_privilege('authenticated','public.mark_payment_status(text,public.payment_status,text,text,jsonb)','EXECUTE'), 'account can confirm payment');
select pg_temp.check_true(has_function_privilege('service_role','public.mark_payment_status(text,public.payment_status,text,text,jsonb)','EXECUTE'), 'provider cannot confirm payment');

-- Cancellation during rescheduling must not revoke a confirmed token.
update public.appointments set status='cancelled' where booking_reference='ACTIVE';
update public.appointments set status='confirmed' where booking_reference='ACTIVE';
select pg_temp.check_true(public.appointment_manage_token_is_active(a), 'reschedule revoked token') from public.appointments a where booking_reference='ACTIVE';

insert into public.appointments(booking_reference, therapist_id, service_id, starts_at, ends_at, status, manage_token_hash, manage_token, created_at)
values ('EXPIRED', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
  '2035-01-01 11:00Z', '2035-01-01 12:00Z', 'pending_payment', repeat('b',64), 'old-secret', now()-interval '6 minutes');
select pg_temp.check_true(not public.appointment_manage_token_is_active(a), 'expired token active before cleanup') from public.appointments a where booking_reference='EXPIRED';
select pg_temp.check_true((select count(*)=0 from public.get_appointment_by_manage_token(repeat('b',64))), 'expired token returned client data');
select pg_temp.check_true(exists(select 1 from public.list_available_slots('11111111-1111-4111-8111-111111111111','2035-01-01','2035-01-01','online') where starts_at='2035-01-01 11:00Z'), 'expired pending blocks availability');
select set_config('test.user_id','33333333-3333-4333-8333-333333333333',false);
update public.appointments set client_id=auth.uid() where booking_reference='EXPIRED';
select pg_temp.check_true(public.appointment_actor(a, repeat('b',64)) is null, 'owner bypasses expired checkout') from public.appointments a where booking_reference='EXPIRED';
do $$ begin
  begin
    insert into public.payments(appointment_id,reference,status,amount_kobo) select id,'EXPIRED-PAY','initiated',10000 from public.appointments where booking_reference='EXPIRED';
    raise exception 'expired checkout accepted payment insert';
  exception when sqlstate 'P0001' then if sqlerrm <> 'checkout_expired' then raise; end if; end;
end $$;
-- Inserting a replacement cleans stale rows before the exclusion constraint.
insert into public.appointments(booking_reference, therapist_id, service_id, starts_at, ends_at, hold_expires_at, manage_token_hash)
values ('REPLACEMENT', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
  '2035-01-01 11:00Z','2035-01-01 12:00Z',now()+interval '5 minutes',repeat('c',64));
select pg_temp.check_true(status='cancelled' and manage_token is null and manage_token_revoked_at is not null,'cleanup did not revoke token') from public.appointments where booking_reference='EXPIRED';
select pg_temp.check_true(public.expire_stale_holds()=0,'cleanup is not idempotent');

insert into public.payments(appointment_id, reference, status, amount_kobo) select id,'LATE-PAY','initiated',10000 from public.appointments where booking_reference='REPLACEMENT';
update public.appointments set created_at=now()-interval '6 minutes', manage_token_expires_at=now()-interval '1 minute' where booking_reference='REPLACEMENT';
select public.mark_payment_status('LATE-PAY','succeeded');
select pg_temp.check_true(status='succeeded','late money lost') from public.payments where reference='LATE-PAY';
select pg_temp.check_true(status='cancelled' and not public.appointment_manage_token_is_active(a),'late payment reactivated expired token') from public.appointments a where booking_reference='REPLACEMENT';
select pg_temp.check_true(public.appointment_manage_token_is_active(a),'unrelated paid token changed') from public.appointments a where booking_reference='ACTIVE';
do $$ begin
  begin
    update public.appointments set package_id=gen_random_uuid(),status='confirmed' where booking_reference='REPLACEMENT';
    raise exception 'expired package checkout was consumed';
  exception when sqlstate 'P0001' then if sqlerrm <> 'checkout_expired' then raise; end if; end;
end $$;
