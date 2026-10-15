-- 0001_init: categories, entries, RLS and default-category seed (SPEC §5).
--
-- Integrity rules enforced here, beyond the column checks:
--   * A subcategory's parent is a main category (parent_id is null) of the same
--     user, and a category is never its own parent. Same-user is enforced
--     declaratively by the composite FK (parent_id, user_id) -> (id, user_id);
--     parent-is-main and the one-level rule by the trigger
--     categories_enforce_hierarchy, which also refuses to turn a category that
--     has subcategories into a subcategory.
--   * Subcategories store their parent's color: the same trigger copies it on
--     insert/update, and categories_propagate_color pushes a main's new color
--     down to its subs.
--   * An entry's category belongs to the entry's user: composite FK
--     (category_id, user_id) -> categories (id, user_id). Because these FKs
--     have no ON UPDATE action they also pin categories.user_id once referenced.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  parent_id   uuid null references public.categories (id),   -- null = main category
  name        text not null check (length(trim(name)) between 1 and 40),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'), -- subs hold the parent's color
  sort_order  int  not null,
  archived_at timestamptz null,
  created_at  timestamptz not null default now(),
  -- target for the same-user composite FKs below
  constraint categories_id_user_id_key unique (id, user_id),
  constraint categories_parent_same_user_fkey
    foreign key (parent_id, user_id) references public.categories (id, user_id)
);

-- Active sibling names are unique per user, case-insensitively. Mains are
-- siblings of each other (parent_id null mapped to the nil uuid).
create unique index categories_active_sibling_name_key
  on public.categories (
    user_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  where archived_at is null;

create index categories_parent_id_idx on public.categories (parent_id);

create table public.entries (
  user_id     uuid not null references auth.users on delete cascade,
  category_id uuid not null references public.categories (id),
  day         date not null,
  hours       numeric(4,2) not null check (hours >= 0 and hours <= 24 and hours * 4 = floor(hours * 4)),
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id, day),
  constraint entries_category_same_user_fkey
    foreign key (category_id, user_id) references public.categories (id, user_id)
);

create index entries_user_id_day_idx on public.entries (user_id, day);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Parent must be an existing main category of the same user; one level only;
-- subs take the parent's color. Runs as the caller, so under RLS another
-- user's category is simply "not found".
create function public.categories_enforce_hierarchy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'category cannot be its own parent'
      using errcode = '23514';
  end if;

  select c.user_id, c.parent_id, c.color
    into parent
    from public.categories c
   where c.id = new.parent_id;

  if not found then
    raise exception 'parent category % not found', new.parent_id
      using errcode = '23503';
  end if;

  if parent.user_id <> new.user_id then
    raise exception 'parent category belongs to another user'
      using errcode = '23514';
  end if;

  if parent.parent_id is not null then
    raise exception 'parent must be a main category (one level of subcategories only)'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'a category with subcategories cannot become a subcategory'
      using errcode = '23514';
  end if;

  new.color := parent.color;
  return new;
end;
$$;

create trigger categories_enforce_hierarchy
  before insert or update on public.categories
  for each row execute function public.categories_enforce_hierarchy();

-- Keep subs' stored color equal to their main's.
create function public.categories_propagate_color()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.categories
     set color = new.color
   where parent_id = new.id
     and color is distinct from new.color;
  return null;
end;
$$;

create trigger categories_propagate_color
  after update of color on public.categories
  for each row
  when (new.parent_id is null and old.color is distinct from new.color)
  execute function public.categories_propagate_color();

create function public.entries_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.entries_set_updated_at();

-- ---------------------------------------------------------------------------
-- Default categories
-- ---------------------------------------------------------------------------

-- Seeds the eight default main categories (no subcategories). Idempotent: does
-- nothing if the user already has any category. Not callable by clients.
create function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.categories where user_id = p_user_id) then
    return;
  end if;

  insert into public.categories (user_id, name, color, sort_order)
  values
    (p_user_id, 'Health',          '#2F8C8C', 0),
    (p_user_id, 'Personal Growth', '#5B6CC0', 1),
    (p_user_id, 'Finance',         '#3E8E4F', 2),
    (p_user_id, 'Family',          '#C9831F', 3),
    (p_user_id, 'Career',          '#C8553D', 4),
    (p_user_id, 'Relaxation',      '#7A5BA8', 5),
    (p_user_id, 'Relationships',   '#C2557F', 6),
    (p_user_id, 'Spirituality',    '#4F7C9E', 7);
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
revoke all on table public.categories, public.entries from anon;
grant select, insert, update, delete on table public.categories, public.entries to authenticated;

alter table public.categories enable row level security;
alter table public.entries enable row level security;

create policy categories_select_own on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy categories_insert_own on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy categories_update_own on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy categories_delete_own on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy entries_select_own on public.entries
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy entries_insert_own on public.entries
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy entries_update_own on public.entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy entries_delete_own on public.entries
  for delete to authenticated
  using (user_id = (select auth.uid()));
