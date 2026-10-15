-- 0002_ratings: daily 0-10 self-rating per main category ("Rate your life", SPEC §10).
--
-- Integrity rules, beyond the column checks:
--   * A rating's category belongs to the rating's user: composite FK
--     (category_id, user_id) -> categories (id, user_id), as for entries.
--   * Ratings are for main categories only: the trigger ratings_enforce_main
--     rejects a category whose parent_id is not null.

create table public.ratings (
  user_id     uuid not null references auth.users on delete cascade,
  category_id uuid not null,
  day         date not null,
  score       smallint not null check (score between 0 and 10),
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id, day),
  constraint ratings_category_same_user_fkey
    foreign key (category_id, user_id) references public.categories (id, user_id)
);

create index ratings_user_id_day_idx on public.ratings (user_id, day);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Main categories only. Runs as the caller; a category the caller cannot see
-- is left to the foreign key to reject.
create function public.ratings_enforce_main()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.categories c
     where c.id = new.category_id
       and c.parent_id is not null
  ) then
    raise exception 'ratings are for main categories only'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger ratings_enforce_main
  before insert or update on public.ratings
  for each row execute function public.ratings_enforce_main();

create function public.ratings_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.ratings_set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

revoke all on table public.ratings from anon;
grant select, insert, update, delete on table public.ratings to authenticated;

alter table public.ratings enable row level security;

create policy ratings_select_own on public.ratings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy ratings_insert_own on public.ratings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy ratings_update_own on public.ratings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy ratings_delete_own on public.ratings
  for delete to authenticated
  using (user_id = (select auth.uid()));
