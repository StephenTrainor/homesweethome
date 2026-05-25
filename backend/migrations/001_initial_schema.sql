-- =====================================================================
-- Home Sweet Home — initial schema
-- Run this in the Supabase SQL editor (or `psql` against the project DB).
-- Safe to re-run: every statement uses IF [NOT] EXISTS / CREATE OR REPLACE.
-- =====================================================================

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- profiles: 1:1 mirror of auth.users so we can join + store app-level fields
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- listings: main row. Money stored as integer cents.
-- ---------------------------------------------------------------------
create table if not exists public.listings (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references public.profiles(id) on delete cascade,
  description              text not null,
  sublet_type              text not null check (sublet_type in ('one_bedroom', 'entire_house')),
  bedrooms                 numeric(4,1) not null check (bedrooms >= 0),
  bathrooms                numeric(4,1) not null check (bathrooms >= 0),
  sqft                     integer check (sqft is null or sqft >= 0),
  monthly_rent_cents       integer not null check (monthly_rent_cents >= 0),
  utilities_included       boolean not null default false,
  additional_fees_cents    integer not null default 0 check (additional_fees_cents >= 0),
  furnished                boolean not null default false,
  location                 text not null,
  address                  text not null,
  start_date               date not null,
  end_date                 date not null,
  status                   text not null default 'active' check (status in ('active', 'inactive', 'rented')),
  idempotency_key          text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint listings_dates_chk check (end_date > start_date)
);

create index if not exists listings_owner_idx       on public.listings (owner_id);
create index if not exists listings_status_idx      on public.listings (status);
create index if not exists listings_created_at_idx  on public.listings (created_at desc);

-- Dedup: same owner + same idempotency_key = same row.
create unique index if not exists listings_owner_idem_uidx
  on public.listings (owner_id, idempotency_key)
  where idempotency_key is not null;

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- listing_amenities: junction table (listing 1 - * amenity)
-- ---------------------------------------------------------------------
create table if not exists public.listing_amenities (
  listing_id uuid not null references public.listings(id) on delete cascade,
  amenity    text not null check (amenity in (
    'wifi','air_conditioning','heating','washer','dryer','dishwasher',
    'parking','gym','pool','pets_allowed','balcony','elevator','doorman','storage'
  )),
  primary key (listing_id, amenity)
);

create index if not exists listing_amenities_amenity_idx
  on public.listing_amenities (amenity);

-- ---------------------------------------------------------------------
-- listing_images: storage paths, ordered
-- ---------------------------------------------------------------------
create table if not exists public.listing_images (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  position     integer not null check (position >= 0),
  created_at   timestamptz not null default now(),
  unique (listing_id, position)
);

create index if not exists listing_images_listing_idx
  on public.listing_images (listing_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.listings          enable row level security;
alter table public.listing_amenities enable row level security;
alter table public.listing_images    enable row level security;

-- profiles: anyone authenticated can read, only owner can write their row.
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles upsert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update using (auth.uid() = id);

-- listings: public read of active listings; owner can read/insert/update/delete their own.
drop policy if exists "listings read active"  on public.listings;
drop policy if exists "listings read own"     on public.listings;
drop policy if exists "listings insert own"   on public.listings;
drop policy if exists "listings update own"   on public.listings;
drop policy if exists "listings delete own"   on public.listings;
create policy "listings read active" on public.listings
  for select using (status = 'active');
create policy "listings read own" on public.listings
  for select using (auth.uid() = owner_id);
create policy "listings insert own" on public.listings
  for insert with check (auth.uid() = owner_id);
create policy "listings update own" on public.listings
  for update using (auth.uid() = owner_id);
create policy "listings delete own" on public.listings
  for delete using (auth.uid() = owner_id);

-- listing_amenities: visible if parent listing is visible; mutated only by owner.
drop policy if exists "amenities read"   on public.listing_amenities;
drop policy if exists "amenities insert" on public.listing_amenities;
drop policy if exists "amenities delete" on public.listing_amenities;
create policy "amenities read" on public.listing_amenities
  for select using (
    exists (select 1 from public.listings l where l.id = listing_id
            and (l.status = 'active' or l.owner_id = auth.uid()))
  );
create policy "amenities insert" on public.listing_amenities
  for insert with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );
create policy "amenities delete" on public.listing_amenities
  for delete using (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

-- listing_images: same pattern as amenities.
drop policy if exists "images read"   on public.listing_images;
drop policy if exists "images insert" on public.listing_images;
drop policy if exists "images delete" on public.listing_images;
create policy "images read" on public.listing_images
  for select using (
    exists (select 1 from public.listings l where l.id = listing_id
            and (l.status = 'active' or l.owner_id = auth.uid()))
  );
create policy "images insert" on public.listing_images
  for insert with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );
create policy "images delete" on public.listing_images
  for delete using (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('listings', 'listings', true)
on conflict (id) do nothing;

-- Path convention: <auth.uid()>/<timestamp>-<n>.<ext>
-- First path segment must equal the user's id for writes.
drop policy if exists "listings storage public read" on storage.objects;
drop policy if exists "listings storage owner write" on storage.objects;
drop policy if exists "listings storage owner update" on storage.objects;
drop policy if exists "listings storage owner delete" on storage.objects;

create policy "listings storage public read" on storage.objects
  for select using (bucket_id = 'listings');

create policy "listings storage owner write" on storage.objects
  for insert with check (
    bucket_id = 'listings'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listings storage owner update" on storage.objects
  for update using (
    bucket_id = 'listings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listings storage owner delete" on storage.objects
  for delete using (
    bucket_id = 'listings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
