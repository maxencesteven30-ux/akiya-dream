-- Akiya Dream — Phase 10A : référentiel régional fiable
-- Ajoute une table de faits régionaux sourcés, tracés et datés.
-- Ne remplace ni ne modifie la table `regions` existante.
-- À exécuter manuellement dans l'éditeur SQL Supabase (même procédé que schema.sql).

-- ============================================================
-- 1. Table
-- ============================================================

create table if not exists region_attributes (
  id bigint generated always as identity primary key,
  region_id bigint not null references regions(id) on delete cascade,
  attribute_key text not null,
  value_type text not null check (value_type in ('boolean', 'numeric', 'integer')),
  value_numeric numeric,              -- boolean encodé 0/1 ; null si confidence = 'unknown'
  source_name text not null,
  source_url text,
  verified_at date not null,
  confidence text not null check (confidence in ('verified', 'estimated', 'unknown')),
  notes text,
  unique (region_id, attribute_key)
);

alter table region_attributes enable row level security;

create policy "Public read access" on region_attributes for select using (true);

-- ============================================================
-- 2. Seed : has_coastline
--
-- Méthode : le Japon compte exactement 8 préfectures enclavées
-- (Tochigi, Gunma, Saitama, Yamanashi, Nagano, Gifu, Nara, Shiga).
-- Toute préfecture japonaise absente de cette liste a une façade
-- maritime. Fait géographique consensuel, vérifié via Wikipedia.
-- Source : https://en.wikipedia.org/wiki/Nagano_Prefecture
-- Vérifié le : 2026-09-11
--
-- Fukuoka_Periph et Hyogo_Rural ne sont PAS des préfectures
-- officielles japonaises (zones composites créées pour l'usage
-- interne de l'application) : aucune source administrative ne
-- peut leur être rattachée. Marquées confidence='unknown',
-- value_numeric=null — pas de valeur inventée.
-- ============================================================

insert into region_attributes (region_id, attribute_key, value_type, value_numeric, source_name, source_url, verified_at, confidence, notes)
select id, 'has_coastline', 'boolean',
  case when name in ('Gifu', 'Nagano') then 0 else 1 end,
  'Liste des 8 préfectures enclavées du Japon (Wikipedia)',
  'https://en.wikipedia.org/wiki/Nagano_Prefecture',
  '2026-09-11',
  'verified',
  case
    when name in ('Gifu', 'Nagano') then 'Préfecture enclavée, aucune façade maritime.'
    else 'Préfecture non enclavée -> façade maritime par élimination (39 des 47 préfectures japonaises ont une côte).'
  end
from regions
where name not in ('Fukuoka_Periph', 'Hyogo_Rural');

insert into region_attributes (region_id, attribute_key, value_type, value_numeric, source_name, source_url, verified_at, confidence, notes)
select id, 'has_coastline', 'boolean', null,
  'Aucune — zone non officielle',
  null,
  '2026-09-11',
  'unknown',
  'Cette zone n''est pas une préfecture administrative japonaise officielle (sous-zone créée pour l''application) : aucune source ne permet de déterminer cet attribut sans hypothèse arbitraire.'
from regions
where name in ('Fukuoka_Periph', 'Hyogo_Rural');
