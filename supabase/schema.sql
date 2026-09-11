-- Akiya Dream — schema + seed data
-- Run this once in the Supabase SQL editor.

-- ============================================================
-- 1. Tables
-- ============================================================

create table if not exists regions (
  id bigint generated always as identity primary key,
  name text not null unique,
  median_price numeric not null,
  median_age numeric not null,
  pre_1981_percent numeric not null,
  subsidy_max numeric not null default 0,
  risk_level text not null check (risk_level in ('A', 'B', 'C'))
);

create table if not exists costs_acquisition (
  id bigint generated always as identity primary key,
  item_name text not null,
  cost_type text not null,
  min_jpy numeric not null default 0,
  max_jpy numeric not null default 0,
  percentage numeric not null default 0
);

create table if not exists costs_renovation (
  id bigint generated always as identity primary key,
  category text not null,
  item_name text not null,
  min_jpy numeric not null default 0,
  max_jpy numeric not null default 0
);

create table if not exists costs_annual (
  id bigint generated always as identity primary key,
  item_name text not null,
  min_jpy numeric not null default 0,
  max_jpy numeric not null default 0,
  percentage numeric not null default 0
);

-- ============================================================
-- 2. Row Level Security — public read-only data
-- ============================================================

alter table regions enable row level security;
alter table costs_acquisition enable row level security;
alter table costs_renovation enable row level security;
alter table costs_annual enable row level security;

create policy "Public read access" on regions for select using (true);
create policy "Public read access" on costs_acquisition for select using (true);
create policy "Public read access" on costs_renovation for select using (true);
create policy "Public read access" on costs_annual for select using (true);

-- ============================================================
-- 3. Seed data
-- ============================================================

insert into regions (name, median_price, median_age, pre_1981_percent, subsidy_max, risk_level) values
  ('Yamaguchi', 3000000, 45, 50, 0, 'A'),
  ('Shimane', 3000000, 50, 61, 0, 'C'),
  ('Tottori', 5000000, 39, 40, 0, 'C'),
  ('Okayama', 3800000, 42, 45, 1200000, 'A'),
  ('Ehime', 4500000, 40, 38, 0, 'A'),
  ('Tokushima', 3600000, 42, 43, 0, 'B'),
  ('Oita', 5000000, 33, 35, 0, 'B'),
  ('Kumamoto', 3900000, 31, 28, 0, 'A'),
  ('Kagoshima', 3800000, 36, 33, 0, 'C'),
  ('Miyazaki', 5000000, 37, 32, 0, 'C'),
  ('Gifu', 4500000, 41, 41, 0, 'B'),
  ('Nagano', 5000000, 37, 38, 0, 'B'),
  ('Wakayama', 4500000, 41, 40, 2000000, 'B'),
  ('Niigata', 2900000, 40, 50, 800000, 'C'),
  ('Aomori', 3000000, 45, 50, 0, 'C'),
  ('Fukuoka_Periph', 4800000, 35, 30, 0, 'B'),
  ('Hyogo_Rural', 5800000, 40, 40, 1500000, 'B'),
  ('Hokkaido', 3000000, 45, 50, 3000000, 'C');

insert into costs_acquisition (item_name, cost_type, min_jpy, max_jpy, percentage) values
  ('Frais_Agence', 'Plafond', 0, 330000, 0),
  ('Taxe_Acquisition', 'Taxe', 0, 0, 3.0),
  ('Droit_Enregistrement', 'Taxe', 0, 0, 1.5),
  ('Timbre_Fiscal', 'Fixe', 1000, 60000, 0),
  ('Shiho_Shoshi', 'Honoraires', 50000, 300000, 0),
  ('Inspection_Technique', 'Service', 30000, 300000, 0),
  ('Traduction_Interprete', 'Service', 50000, 200000, 0);

insert into costs_renovation (category, item_name, min_jpy, max_jpy) values
  ('Global', 'Rafraichissement_Leger', 2000000, 5000000),
  ('Global', 'Renovation_Standard', 5000000, 12000000),
  ('Global', 'Renovation_Lourde_Kominka', 10000000, 25000000),
  ('Specifique', 'Toiture', 500000, 2000000),
  ('Specifique', 'Cuisine', 500000, 1500000),
  ('Specifique', 'Salle_de_Bain', 500000, 1500000),
  ('Specifique', 'Electricite', 300000, 800000),
  ('Specifique', 'Plomberie', 300000, 800000),
  ('Specifique', 'Renforcement_Sismique', 1000000, 3000000),
  ('Specifique', 'Traitement_Termites', 100000, 300000);

insert into costs_annual (item_name, min_jpy, max_jpy, percentage) values
  ('Taxe_Fonciere', 30000, 150000, 1.4),
  ('Taxe_Urbanisme', 0, 30000, 0.3),
  ('Gestion_Distance', 33000, 150000, 0),
  ('Assurance', 20000, 120000, 0),
  ('Entretien_Jardin', 0, 150000, 0),
  ('Controle_Fosse_Septique', 10000, 60000, 0),
  ('Provision_Reparations', 50000, 300000, 0),
  ('Comptable_Godo_Kaisha', 200000, 300000, 0);
