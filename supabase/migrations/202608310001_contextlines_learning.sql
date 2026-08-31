create extension if not exists pgcrypto;

create table public.saved_expressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expression text not null check (char_length(btrim(expression)) between 1 and 160),
  source_transcript text not null check (char_length(btrim(source_transcript)) between 1 and 1200),
  meaning_zh text not null check (char_length(btrim(meaning_zh)) between 1 and 600),
  intent text not null check (char_length(btrim(intent)) between 1 and 600),
  usage_note text not null check (char_length(btrim(usage_note)) between 1 and 600),
  personal_example text not null check (
    char_length(btrim(personal_example)) between 1 and 600
    and position(lower(btrim(expression)) in lower(personal_example)) > 0
  ),
  meaning_classification text not null check (
    meaning_classification in ('language_fact', 'scene_inference', 'external_fact')
  ),
  schema_version integer not null check (schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  saved_expression_id uuid not null references public.saved_expressions(id) on delete cascade,
  card_type text not null check (
    card_type in ('personal_cloze', 'scene_to_english', 'english_to_meaning')
  ),
  due_at timestamptz not null default now(),
  stability double precision not null default 0 check (stability >= 0),
  difficulty double precision not null default 0 check (difficulty >= 0),
  elapsed_days integer not null default 0 check (elapsed_days >= 0),
  scheduled_days integer not null default 0 check (scheduled_days >= 0),
  learning_steps integer not null default 0 check (learning_steps >= 0),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  state smallint not null default 0 check (state between 0 and 3),
  last_review_at timestamptz,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (saved_expression_id, card_type)
);

create index review_cards_due_idx on public.review_cards (user_id, due_at);

create table public.review_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  review_card_id uuid not null references public.review_cards(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  before_state jsonb not null,
  after_state jsonb not null,
  reviewed_at timestamptz not null default now()
);

create index review_events_user_time_idx on public.review_events (user_id, reviewed_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger saved_expressions_set_updated_at
before update on public.saved_expressions
for each row execute function public.set_updated_at();

create trigger review_cards_set_updated_at
before update on public.review_cards
for each row execute function public.set_updated_at();

create function public.create_review_cards_for_expression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.review_cards (user_id, saved_expression_id, card_type)
  values
    (new.user_id, new.id, 'personal_cloze'),
    (new.user_id, new.id, 'scene_to_english'),
    (new.user_id, new.id, 'english_to_meaning');
  return new;
end;
$$;

create trigger saved_expression_create_review_cards
after insert on public.saved_expressions
for each row execute function public.create_review_cards_for_expression();

create function public.record_review(
  p_card_id uuid,
  p_expected_version integer,
  p_rating smallint,
  p_due_at timestamptz,
  p_stability double precision,
  p_difficulty double precision,
  p_elapsed_days integer,
  p_scheduled_days integer,
  p_learning_steps integer,
  p_reps integer,
  p_lapses integer,
  p_state smallint,
  p_last_review_at timestamptz,
  p_before_state jsonb,
  p_after_state jsonb
)
returns public.review_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_card public.review_cards;
  updated_card public.review_cards;
begin
  if p_rating not between 1 and 4 then
    raise exception 'invalid review rating' using errcode = '22023';
  end if;

  select * into current_card
  from public.review_cards
  where id = p_card_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'review card not found' using errcode = 'P0002';
  end if;

  if current_card.version <> p_expected_version then
    raise exception 'review card version conflict' using errcode = '40001';
  end if;

  update public.review_cards
  set
    due_at = p_due_at,
    stability = p_stability,
    difficulty = p_difficulty,
    elapsed_days = p_elapsed_days,
    scheduled_days = p_scheduled_days,
    learning_steps = p_learning_steps,
    reps = p_reps,
    lapses = p_lapses,
    state = p_state,
    last_review_at = p_last_review_at,
    version = version + 1
  where id = p_card_id
  returning * into updated_card;

  insert into public.review_events (
    user_id,
    review_card_id,
    rating,
    before_state,
    after_state,
    reviewed_at
  ) values (
    current_card.user_id,
    current_card.id,
    p_rating,
    p_before_state,
    p_after_state,
    p_last_review_at
  );

  return updated_card;
end;
$$;

alter table public.saved_expressions enable row level security;
alter table public.review_cards enable row level security;
alter table public.review_events enable row level security;

create policy saved_expressions_owner_all on public.saved_expressions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy review_cards_owner_select on public.review_cards
for select to authenticated
using (user_id = auth.uid());

create policy review_events_owner_select on public.review_events
for select to authenticated
using (user_id = auth.uid());

revoke all on function public.record_review(
  uuid, integer, smallint, timestamptz, double precision, double precision,
  integer, integer, integer, integer, integer, smallint, timestamptz, jsonb, jsonb
) from public;
grant execute on function public.record_review(
  uuid, integer, smallint, timestamptz, double precision, double precision,
  integer, integer, integer, integer, integer, smallint, timestamptz, jsonb, jsonb
) to authenticated;
