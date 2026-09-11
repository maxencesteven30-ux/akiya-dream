-- Akiya Dream — sauvegarde des projets (section 18 du prompt maître)
-- Authentification anonyme Supabase (auth.uid() réel, pas un identifiant
-- client falsifiable) : chaque projet appartient à un utilisateur anonyme
-- créé automatiquement au premier usage, sans formulaire de connexion.
--
-- PRÉREQUIS avant d'exécuter cette migration :
-- Dashboard Supabase -> Authentication -> Providers -> activer
-- "Allow anonymous sign-ins". Sans ça, signInAnonymously() échoue et
-- aucune sauvegarde n'est possible (l'app continue de fonctionner
-- normalement pour tout le reste, dégradation gracieuse).
--
-- À exécuter manuellement dans l'éditeur SQL Supabase.

create table if not exists projects (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  profile text not null check (profile in ('solo', 'duo', 'investisseur')),
  house_price_jpy numeric not null,
  prefecture text,
  renovation_level text check (renovation_level in ('leger', 'standard', 'lourd')),
  capital_disponible_eur numeric,
  reserve_securite_eur numeric,
  real_listing jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on projects(user_id);

alter table projects enable row level security;

-- Chaque utilisateur (anonyme ou non) ne voit et ne modifie que SES
-- propres projets. auth.uid() est vérifié côté serveur par Supabase,
-- un client ne peut pas l'usurper.
create policy "Users can view their own projects" on projects
  for select using (auth.uid() = user_id);

create policy "Users can insert their own projects" on projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own projects" on projects
  for update using (auth.uid() = user_id);

create policy "Users can delete their own projects" on projects
  for delete using (auth.uid() = user_id);
