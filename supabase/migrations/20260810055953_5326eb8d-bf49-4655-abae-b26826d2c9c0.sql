with target as (
  select id, metadata
  from public.content_entries
  where kind = 'page'
    and slug = 'services'
    and jsonb_typeof(metadata -> 'sections') = 'array'
),
updated as (
  select
    t.id,
    jsonb_set(
      t.metadata,
      '{sections}',
      coalesce(
        (
          select jsonb_agg(
            case
              when s ->> 'type' = 'featureList'
                and jsonb_typeof(s -> 'cards') = 'array'
              then jsonb_set(
                s,
                '{cards}',
                coalesce(
                  (
                    select jsonb_agg(
                      case
                        when c ->> 'title' in ('Individual Therapy', 'Teen/Child Therapy')
                          then c || jsonb_build_object('tone', 'dark')
                        else c || jsonb_build_object('tone', coalesce(c ->> 'tone', 'default'))
                      end
                      order by cord
                    )
                    from jsonb_array_elements(s -> 'cards') with ordinality as ce(c, cord)
                  ),
                  '[]'::jsonb
                )
              )
              else s
            end
            order by ord
          )
          from jsonb_array_elements(t.metadata -> 'sections') with ordinality as se(s, ord)
        ),
        t.metadata -> 'sections'
      )
    ) as metadata
  from target t
)
update public.content_entries e
set metadata = u.metadata
from updated u
where e.id = u.id;
