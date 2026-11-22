-- PIECE OF US — schema
-- All tables have RLS enabled with NO public policies: browsers never talk to
-- the database directly. Every read/write goes through the Next.js server with
-- the service-role key, so moderation, payment and publication rules live in
-- one audited place and cannot be bypassed from the client.


-- ─────────────────────────────── Founding Collection ───────────────────────────────
create table if not exists public.founding_pieces (
  tile       integer primary key check (tile >= 0 and tile < 1000000),
  kind       smallint not null,
  seed       integer  not null,
  palette    smallint not null,
  hidden     boolean  not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────── Submissions ───────────────────────────────
-- Lifecycle:
--   awaiting_payment  → AI (or a moderator) approved; contributor may pay
--   in_review         → AI uncertain / unavailable; square held, human decides
--   appealed          → contributor asked for a human review of a rejection
--   rejected          → never charged; square released
--   published         → approved AND payment verified (the only public state)
--   removed           → taken down after publication (refunded)
--   refunded          → paid but could not be published (conflict / mismatch)
--   expired           → approved but never paid; square released
create table if not exists public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  tile                integer not null check (tile >= 0 and tile < 1000000),
  status              text not null check (status in
                       ('awaiting_payment','in_review','appealed','rejected','published','removed','refunded','expired')),
  display_name        text check (char_length(display_name) <= 60),
  country             text check (char_length(country) <= 60),
  title               text check (char_length(title) <= 80),
  description         text check (char_length(description) <= 150),
  email               text check (char_length(email) <= 254),   -- optional, only for decision notices
  contact_instagram   text check (contact_instagram ~ '^[A-Za-z0-9._]{1,30}$'),  -- optional, shown publicly
  contact_email       text check (char_length(contact_email) <= 254),           -- optional, shown publicly
  contact_phone       text check (contact_phone ~ '^\+?[0-9 ()-]{7,24}$'),     -- optional, shown publicly
  image_path          text not null,                            -- private bucket
  thumb_path          text not null,
  avg_color           text not null check (avg_color ~ '^#[0-9a-f]{6}$'),
  access_token_hash   text not null,
  rights_confirmed    boolean not null check (rights_confirmed),
  ip_hash             text,
  hold_until          timestamptz,
  -- moderation
  moderation_decision text check (moderation_decision in ('approved','pending_review','rejected')),
  moderation_categories text[] not null default '{}',
  moderation_scores   jsonb not null default '{}',
  moderation_detail   jsonb not null default '{}',
  moderation_provider text,
  extracted_text      text,
  moderated_at        timestamptz,
  public_reason       text,
  appeal_message      text check (char_length(appeal_message) <= 500),
  appealed_at         timestamptz,
  reviewed_at         timestamptz,
  reviewed_by         text,
  -- payment
  payment_provider    text,
  payment_order_id    text,
  payment_capture_id  text,
  amount_cents        integer,
  currency            text,
  paid_at             timestamptz,
  published_at        timestamptz,
  refund_id           text,
  refunded_at         timestamptz,
  notified_at         timestamptz,
  created_at          timestamptz not null default now(),
  unique (payment_provider, payment_order_id)
);
create index if not exists submissions_status_idx on public.submissions (status, created_at desc);
create index if not exists submissions_tile_idx on public.submissions (tile);
create index if not exists submissions_categories_idx on public.submissions using gin (moderation_categories);
create unique index if not exists submissions_one_published_per_tile
  on public.submissions (tile) where status = 'published';

-- ─────────────────────────────── Tile claims ───────────────────────────────
-- Single source of truth for who holds a square. The primary key makes
-- double-selling impossible.
create table if not exists public.tile_claims (
  tile          integer primary key check (tile >= 0 and tile < 1000000),
  kind          text not null check (kind in ('reservation','submission','founding')),
  token_hash    text,
  submission_id uuid references public.submissions(id) on delete cascade,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists tile_claims_expiry_idx on public.tile_claims (expires_at) where expires_at is not null;

-- ─────────────────────────────── Moderation log ───────────────────────────────
-- Append-only record of every automated and human decision, note and report action.
create table if not exists public.moderation_events (
  id            bigserial primary key,
  submission_id uuid references public.submissions(id) on delete set null,
  report_id     bigint,
  tile          integer,
  actor         text not null,               -- 'system' | 'contributor' | 'admin:<username>'
  action        text not null,               -- auto_decision | approve | reject | remove | override | note | appeal | refund | report_dismiss | report_action
  from_status   text,
  to_status     text,
  note          text,
  data          jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists moderation_events_sub_idx on public.moderation_events (submission_id, created_at desc);
create or replace function public.forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'moderation_events is append-only'; end $$;
drop trigger if exists moderation_events_append_only on public.moderation_events;
create trigger moderation_events_append_only before update or delete on public.moderation_events
  for each row execute function public.forbid_mutation();

-- ─────────────────────────────── Reports ───────────────────────────────
create table if not exists public.reports (
  id            bigserial primary key,
  tile          integer not null,
  submission_id uuid references public.submissions(id) on delete set null,
  founding      boolean not null default false,
  reason        text not null check (reason in
                  ('hate','violence','sexual','political','copyright','privacy','spam','other')),
  details       text check (char_length(details) <= 500),
  reporter_hash text,
  status        text not null default 'open' check (status in ('open','dismissed','actioned')),
  resolved_by   text,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
-- one report per person per piece
create unique index if not exists reports_one_per_reporter on public.reports (tile, reporter_hash) where status = 'open';

-- ─────────────────────────────── Payment events (webhook idempotency) ───────────────────────────────
create table if not exists public.payment_events (
  id          bigserial primary key,
  provider    text not null,
  event_id    text not null,
  event_type  text not null,
  payload     jsonb not null,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table if not exists public.rate_limits (
  key      text primary key,
  count    integer not null,
  reset_at timestamptz not null
);

alter table public.founding_pieces   enable row level security;
alter table public.submissions       enable row level security;
alter table public.tile_claims       enable row level security;
alter table public.moderation_events enable row level security;
alter table public.reports           enable row level security;
alter table public.payment_events    enable row level security;
alter table public.rate_limits       enable row level security;

-- ═══════════════════════════════ Functions ═══════════════════════════════

create or replace function public.reserve_tile(p_tile integer, p_token_hash text, p_minutes integer)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_exp timestamptz;
begin
  delete from tile_claims where tile = p_tile and expires_at is not null and expires_at < now();
  insert into tile_claims (tile, kind, token_hash, expires_at)
       values (p_tile, 'reservation', p_token_hash, now() + make_interval(mins => p_minutes))
  on conflict (tile) do update set expires_at = excluded.expires_at
     where tile_claims.kind = 'reservation' and tile_claims.token_hash = excluded.token_hash
  returning expires_at into v_exp;
  return v_exp;
end $$;

create or replace function public.release_tile(p_tile integer, p_token_hash text)
returns void language sql security definer set search_path = public as $$
  delete from tile_claims where tile = p_tile and kind = 'reservation' and token_hash = p_token_hash;
$$;

-- Atomically turn a reservation into a moderated submission.
-- The moderation outcome decides the initial status and how long the square is held.
create or replace function public.create_submission(
  p_id uuid, p_tile integer, p_token_hash text, p_access_hash text,
  p_display_name text, p_country text, p_title text, p_description text, p_email text,
  p_contact_instagram text, p_contact_email text, p_contact_phone text,
  p_image_path text, p_thumb_path text, p_avg_color text, p_ip_hash text,
  p_decision text, p_categories text[], p_scores jsonb, p_detail jsonb, p_provider text,
  p_extracted_text text, p_public_reason text, p_hold_minutes integer
) returns public.submissions language plpgsql security definer set search_path = public as $$
declare c tile_claims; s submissions; v_status text;
begin
  select * into c from tile_claims where tile = p_tile for update;
  if c.tile is null or c.kind <> 'reservation' or c.token_hash <> p_token_hash or c.expires_at < now() then
    return null;
  end if;
  v_status := case p_decision when 'approved' then 'awaiting_payment'
                              when 'rejected' then 'rejected' else 'in_review' end;
  insert into submissions (id, tile, status, display_name, country, title, description, email,
                           contact_instagram, contact_email, contact_phone,
                           image_path, thumb_path, avg_color, access_token_hash, rights_confirmed, ip_hash,
                           hold_until, moderation_decision, moderation_categories, moderation_scores,
                           moderation_detail, moderation_provider, extracted_text, moderated_at, public_reason)
       values (p_id, p_tile, v_status, p_display_name, p_country, p_title, p_description, p_email,
               p_contact_instagram, p_contact_email, p_contact_phone,
               p_image_path, p_thumb_path, p_avg_color, p_access_hash, true, p_ip_hash,
               case when v_status = 'rejected' then null else now() + make_interval(mins => p_hold_minutes) end,
               p_decision, p_categories, p_scores, p_detail, p_provider, p_extracted_text, now(), p_public_reason)
    returning * into s;
  if v_status = 'rejected' then
    delete from tile_claims where tile = p_tile;
  else
    update tile_claims set kind = 'submission', submission_id = s.id, token_hash = null, expires_at = s.hold_until
     where tile = p_tile;
  end if;
  insert into moderation_events (submission_id, tile, actor, action, to_status, data)
       values (s.id, p_tile, 'system', 'auto_decision', v_status,
               jsonb_build_object('decision', p_decision, 'categories', p_categories, 'provider', p_provider));
  return s;
end $$;

-- Idempotent payment confirmation (webhook + return URL). Publishes only if the
-- submission is moderation-approved and still holds its square.
create or replace function public.confirm_payment(
  p_provider text, p_order_id text, p_capture_id text, p_amount integer, p_currency text
) returns table (result text, submission_id uuid) language plpgsql security definer set search_path = public as $$
declare s submissions; c tile_claims;
begin
  select * into s from submissions where payment_provider = p_provider and payment_order_id = p_order_id for update;
  if s.id is null then return query select 'unknown'::text, null::uuid; return; end if;
  if s.paid_at is not null then return query select 'already'::text, s.id; return; end if;

  update submissions set paid_at = now(), payment_capture_id = p_capture_id,
                         amount_cents = p_amount, currency = p_currency where id = s.id;

  if p_amount <> 800 or p_currency <> 'USD' then
    return query select 'amount_mismatch'::text, s.id; return;
  end if;
  if s.status <> 'awaiting_payment' then
    return query select 'not_payable'::text, s.id; return;
  end if;

  delete from tile_claims where tile = s.tile and expires_at is not null and expires_at < now();
  select * into c from tile_claims where tile = s.tile for update;
  if c.tile is not null and (c.kind <> 'submission' or c.submission_id <> s.id) then
    return query select 'conflict'::text, s.id; return;
  end if;
  if c.tile is null then
    insert into tile_claims (tile, kind, submission_id) values (s.tile, 'submission', s.id)
    on conflict (tile) do nothing;
    if not found then return query select 'conflict'::text, s.id; return; end if;
  else
    update tile_claims set expires_at = null where tile = s.tile;
  end if;
  update submissions set status = 'published', published_at = now(), hold_until = null where id = s.id;
  insert into moderation_events (submission_id, tile, actor, action, from_status, to_status)
       values (s.id, s.tile, 'system', 'publish', 'awaiting_payment', 'published');
  return query select 'confirmed'::text, s.id;
end $$;

-- Human decisions. p_hold_minutes is used when a reviewer approves an
-- unpaid submission (the contributor then gets time to pay).
create or replace function public.moderate_submission(
  p_id uuid, p_action text, p_actor text, p_reason text, p_note text, p_hold_minutes integer
) returns public.submissions language plpgsql security definer set search_path = public as $$
declare s submissions; v_to text; v_from text;
begin
  select * into s from submissions where id = p_id for update;
  if s.id is null then return null; end if;
  v_from := s.status;
  if p_action = 'approve' then
    if s.status not in ('in_review','appealed','rejected') then return s; end if;
    -- re-take the square; it may have been released after a rejection
    delete from tile_claims where tile = s.tile and expires_at is not null and expires_at < now();
    insert into tile_claims (tile, kind, submission_id, expires_at)
         values (s.tile, 'submission', s.id, now() + make_interval(mins => p_hold_minutes))
    on conflict (tile) do update set expires_at = excluded.expires_at
       where tile_claims.kind = 'submission' and tile_claims.submission_id = s.id;
    if not found then
      raise exception 'square_taken';
    end if;
    v_to := 'awaiting_payment';
    update submissions set status = v_to, hold_until = now() + make_interval(mins => p_hold_minutes),
           reviewed_at = now(), reviewed_by = p_actor, public_reason = null
     where id = p_id returning * into s;
  elsif p_action in ('reject','remove') then
    v_to := case when p_action = 'remove' then 'removed' else 'rejected' end;
    update submissions set status = v_to, reviewed_at = now(), reviewed_by = p_actor,
           public_reason = coalesce(p_reason, public_reason), hold_until = null
     where id = p_id returning * into s;
    delete from tile_claims where tile = s.tile and kind = 'submission' and submission_id = s.id;
  elsif p_action = 'note' then
    v_to := s.status;
  else
    raise exception 'unknown action %', p_action;
  end if;
  insert into moderation_events (submission_id, tile, actor, action, from_status, to_status, note)
       values (s.id, s.tile, p_actor, p_action, v_from, v_to, p_note);
  return s;
end $$;

-- Contributor asks for a human review of an automated rejection.
create or replace function public.appeal_submission(p_id uuid, p_message text, p_hold_minutes integer)
returns text language plpgsql security definer set search_path = public as $$
declare s submissions;
begin
  select * into s from submissions where id = p_id for update;
  if s.id is null then return 'not_found'; end if;
  if s.status <> 'rejected' or s.reviewed_by is not null or s.appealed_at is not null then return 'not_appealable'; end if;
  delete from tile_claims where tile = s.tile and expires_at is not null and expires_at < now();
  insert into tile_claims (tile, kind, submission_id, expires_at)
       values (s.tile, 'submission', s.id, now() + make_interval(mins => p_hold_minutes))
  on conflict (tile) do nothing;
  -- if the square was taken meanwhile, the appeal still goes ahead; a moderator
  -- can approve it only once the square is free.
  update submissions set status = 'appealed', appeal_message = p_message, appealed_at = now(),
         hold_until = now() + make_interval(mins => p_hold_minutes)
   where id = p_id;
  insert into moderation_events (submission_id, tile, actor, action, from_status, to_status, note)
       values (s.id, s.tile, 'contributor', 'appeal', 'rejected', 'appealed', p_message);
  return 'ok';
end $$;

create or replace function public.set_founding_hidden(p_tile integer, p_hidden boolean)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from founding_pieces where tile = p_tile) then return 'not_found'; end if;
  if p_hidden then
    update founding_pieces set hidden = true where tile = p_tile;
    delete from tile_claims where tile = p_tile and kind = 'founding';
    return 'ok';
  end if;
  delete from tile_claims where tile = p_tile and expires_at is not null and expires_at < now();
  insert into tile_claims (tile, kind) values (p_tile, 'founding') on conflict (tile) do nothing;
  if not found then return 'square_in_use'; end if;
  update founding_pieces set hidden = false where tile = p_tile;
  return 'ok';
end $$;

create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into rate_limits (key, count, reset_at)
       values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
       set count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
           reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
  returning count into v;
  return v <= p_max;
end $$;

-- Whole-canvas state in one call (bypasses the PostgREST row cap).
-- Only published submissions expose a colour; held squares show as "held".
-- state: 1 held · 2 held (in review) · 3 published · 4 founding
create or replace function public.mosaic_overview()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_array(r.t, r.st, r.col, r.k, r.sd, r.p) order by r.t), '[]'::json) from (
    select c.tile as t,
           case when c.kind = 'founding' then 4
                when c.kind = 'reservation' then 1
                when s.status = 'published' then 3
                when s.status in ('in_review','appealed') then 2
                else 1 end as st,
           case when s.status = 'published' then s.avg_color end as col,
           f.kind as k, f.seed as sd, f.palette as p
      from tile_claims c
      left join submissions s on s.id = c.submission_id
      left join founding_pieces f on f.tile = c.tile and c.kind = 'founding'
     where c.expires_at is null or c.expires_at > now()
  ) r;
$$;

create or replace function public.admin_money()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'revenue_cents',  coalesce(sum(amount_cents) filter (where paid_at is not null), 0),
    'refunded_cents', coalesce(sum(amount_cents) filter (where refunded_at is not null), 0),
    'paid',           count(*) filter (where paid_at is not null),
    'published',      count(*) filter (where status = 'published'),
    'awaiting',       count(*) filter (where status = 'awaiting_payment'),
    'in_review',      count(*) filter (where status in ('in_review','appealed')),
    'rejected',       count(*) filter (where status = 'rejected'),
    'open_reports',   (select count(*) from reports where status = 'open')
  ) from submissions;
$$;

-- Expire approved-but-unpaid submissions whose hold ran out.
create or replace function public.expire_holds()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with e as (
    update submissions set status = 'expired'
     where status in ('awaiting_payment') and hold_until < now() and paid_at is null
    returning id, tile
  ) select count(*) into n from e;
  delete from tile_claims where expires_at is not null and expires_at < now();
  return n;
end $$;

-- Data retention (see Privacy Policy). Returns storage paths to delete.
--  · images of rejected / expired / removed submissions: 30 days after decision
--  · contributor e-mail: 30 days after a final decision
--  · IP hashes: 90 days
--  · reports: details cleared after 1 year
create or replace function public.apply_retention()
returns setof text language plpgsql security definer set search_path = public as $$
begin
  update submissions set ip_hash = null where ip_hash is not null and created_at < now() - interval '90 days';
  update submissions set email = null
   where email is not null and status in ('published','rejected','removed','refunded','expired')
     and coalesce(reviewed_at, published_at, created_at) < now() - interval '30 days';
  update reports set details = null, reporter_hash = null where created_at < now() - interval '365 days';
  return query
    with doomed as (
      select id, image_path, thumb_path from submissions
       where status in ('rejected','expired','removed','refunded') and image_path <> 'deleted'
         and coalesce(reviewed_at, hold_until, created_at) < now() - interval '30 days'
         for update
    ), upd as (
      update submissions s set image_path = 'deleted', thumb_path = 'deleted'
        from doomed d where s.id = d.id
      returning d.image_path as a, d.thumb_path as b
    )
    select unnest(array[a, b]) from upd;
end $$;

-- Functions are callable only by the server (service role), never by browsers.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- ─────────────────────────────── Storage ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 4194304, array['image/webp']),
       ('pieces',      'pieces',      true,  4194304, array['image/webp'])
on conflict (id) do nothing;
