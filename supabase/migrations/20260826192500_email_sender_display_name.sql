update public.email_settings
set
  sender_domain = 'talkspace.ng',
  from_name = coalesce(nullif(trim(from_name), ''), 'Talk Space Counselling'),
  from_email = case
    when from_email is null or trim(from_email) = '' or from_email = contact_inbox or from_email like '%@notify.talkspace.ng'
      then 'notifications@talkspace.ng'
    else from_email
  end,
  reply_to = coalesce(nullif(trim(reply_to), ''), 'email@talkspace.ng'),
  contact_inbox = coalesce(nullif(trim(contact_inbox), ''), 'email@talkspace.ng')
where id = 1;
