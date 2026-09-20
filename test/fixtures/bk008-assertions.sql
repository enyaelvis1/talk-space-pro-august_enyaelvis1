-- Runs only in the disposable BK-008 database.
alter table public.appointments add column rescheduled_from_starts_at timestamptz;
create function pg_temp.check_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end; $$;

insert into public.services(id, duration_minutes) values
  ('11111111-1111-4111-8111-111111111111', 60),
  ('11111111-1111-4111-8111-111111111112', 90);
insert into public.therapists(id) values
  ('22222222-2222-4222-8222-222222222221'),
  ('22222222-2222-4222-8222-222222222222'),
  ('22222222-2222-4222-8222-222222222223'),
  ('22222222-2222-4222-8222-222222222224');
insert into public.therapist_services
select t.id, s.id from public.therapists t cross join public.services s
where t.id <> '22222222-2222-4222-8222-222222222224';
insert into public.availability_exceptions
select t.id, '2035-01-01 08:00Z', '2035-01-01 20:00Z', m, 'added'
from public.therapists t cross join unnest(enum_range(null::public.session_mode)) m;

-- Call the real RPC rather than inserting test holds directly.
create function public.test_hold(s uuid, t uuid, at_time timestamptz, m public.session_mode default 'online')
returns uuid language sql as $$
  select id from public.hold_appointment(s,t,m,at_time,'Test Client','client@example.test',
    '+2348000000000',null,repeat('a',64),null);
$$;

do $$ declare a uuid; b uuid; begin
  a := public.test_hold('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','2035-01-01 09:00Z');
  b := public.test_hold('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','2035-01-01 09:00Z');
  perform pg_temp.check_true(a <> b, 'same-service holds collapsed');
  insert into public.payments(appointment_id,reference,status,amount_kobo) values
    (a,'BK008-A','initiated',10000),(b,'BK008-B','initiated',10000);
  perform public.mark_payment_status('BK008-A','succeeded');
  perform public.mark_payment_status('BK008-B','succeeded');
  perform pg_temp.check_true((select count(*)=2 and count(distinct booking_reference)=2
    from public.appointments where starts_at='2035-01-01 09:00Z' and status='confirmed'),
    'same-time payments did not confirm separate appointments');
end $$;

select pg_temp.check_true(exists(select 1 from public.list_available_slots(
  '11111111-1111-4111-8111-111111111111','2035-01-01','2035-01-01','online')
  where therapist_id='22222222-2222-4222-8222-222222222223' and starts_at='2035-01-01 09:00Z'),
  'unrelated therapist was globally blocked');
select pg_temp.check_true(not exists(select 1 from public.list_available_slots(
  '11111111-1111-4111-8111-111111111111','2035-01-01','2035-01-01','online')
  where therapist_id='22222222-2222-4222-8222-222222222224'), 'unassigned therapist offered');

do $$ declare a uuid; b uuid; begin
  a := public.test_hold('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','2035-01-01 11:00Z');
  b := public.test_hold('11111111-1111-4111-8111-111111111112','22222222-2222-4222-8222-222222222222','2035-01-01 11:00Z');
  insert into public.payments(appointment_id,reference,status,amount_kobo) values
    (a,'BK008-C','initiated',10000),(b,'BK008-D','initiated',20000);
  perform public.mark_payment_status('BK008-C','succeeded');
  perform public.mark_payment_status('BK008-D','succeeded');
  perform pg_temp.check_true((select count(distinct service_id)=2 from public.appointments
    where starts_at='2035-01-01 11:00Z' and status='confirmed'), 'different services globally blocked');
  begin
    perform public.test_hold('11111111-1111-4111-8111-111111111112','22222222-2222-4222-8222-222222222221','2035-01-01 11:15Z');
    raise exception 'same therapist overlapping different service accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'slot_unavailable' then raise; end if; end;
  begin
    perform public.test_hold('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','2035-01-01 11:00Z','in_person');
    raise exception 'mode change bypassed therapist overlap';
  exception when sqlstate 'P0001' then if sqlerrm <> 'slot_unavailable' then raise; end if; end;
  perform public.test_hold('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222223','2035-01-01 11:00Z','in_person');
end $$;

-- Cancelling A must not release B's slot.
update public.appointments set status='cancelled', cancelled_at=now(), hold_expires_at=null
where therapist_id='22222222-2222-4222-8222-222222222221' and starts_at='2035-01-01 09:00Z';
select pg_temp.check_true(exists(select 1 from public.list_available_slots(
  '11111111-1111-4111-8111-111111111111','2035-01-01','2035-01-01','online')
  where therapist_id='22222222-2222-4222-8222-222222222221' and starts_at='2035-01-01 09:00Z'), 'cancelled therapist did not reopen');
select pg_temp.check_true(not exists(select 1 from public.list_available_slots(
  '11111111-1111-4111-8111-111111111111','2035-01-01','2035-01-01','online')
  where therapist_id='22222222-2222-4222-8222-222222222222' and starts_at='2035-01-01 09:00Z'), 'cancellation released another therapist');

-- Service buffers still apply only to the booked therapist.
update public.appointments set status='cancelled', cancelled_at=now(), hold_expires_at=null
where therapist_id='22222222-2222-4222-8222-222222222223' and starts_at='2035-01-01 11:00Z';
update public.services set buffer_after_minutes=15 where id='11111111-1111-4111-8111-111111111111';
select pg_temp.check_true(not exists(select 1 from public.list_available_slots(
  '11111111-1111-4111-8111-111111111112','2035-01-01','2035-01-01','online')
  where therapist_id='22222222-2222-4222-8222-222222222221' and starts_at='2035-01-01 12:00Z'), 'therapist buffer ignored');
select pg_temp.check_true(exists(select 1 from public.list_available_slots(
  '11111111-1111-4111-8111-111111111112','2035-01-01','2035-01-01','online')
  where therapist_id='22222222-2222-4222-8222-222222222223' and starts_at='2035-01-01 12:00Z'), 'unrelated therapist buffer leaked');

-- An explicit therapist reassignment must preserve the chosen therapist and reference.
select * from public.reschedule_appointment(
  (select appointment_id from public.payments where reference='BK008-B'),
  '2035-01-01 14:00Z',repeat('a',64),'22222222-2222-4222-8222-222222222223','online');
select pg_temp.check_true(therapist_id='22222222-2222-4222-8222-222222222223'
  and starts_at='2035-01-01 14:00Z' and status='confirmed', 'reschedule lost selected therapist')
from public.appointments where id=(select appointment_id from public.payments where reference='BK008-B');
