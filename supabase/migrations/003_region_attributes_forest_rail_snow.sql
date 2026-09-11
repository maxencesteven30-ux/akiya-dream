-- Akiya Dream — Phase 10A (suite) : forest_area_percent, shinkansen_station_count,
-- avg_annual_snowfall_cm pour les 16 vraies préfectures.
-- À exécuter manuellement dans l'éditeur SQL Supabase, après 002_region_attributes.sql.

-- ============================================================
-- forest_area_percent
-- Source : Statistics Japan, "Rate of Forest Land by Prefecture"
-- (compile les statistiques de l'Agence des forêts / 林野庁, données 2012).
-- https://stats-japan.com/t/kiji/10701
-- Limite assumée : source secondaire, données 2012 (les plus récentes
-- consolidées trouvées) — à revérifier sur une publication plus récente
-- de l'Agence des forêts si possible. D'où confidence='estimated'.
-- ============================================================

insert into region_attributes (region_id, attribute_key, value_type, value_numeric, source_name, source_url, verified_at, confidence, notes)
select r.id, 'forest_area_percent', 'numeric', v.pct,
  'Statistics Japan — Rate of Forest Land by Prefecture (Agence des forêts, données 2012)',
  'https://stats-japan.com/t/kiji/10701',
  '2026-09-11', 'estimated',
  'Donnée 2012 (la plus récente consolidée trouvée) via une source secondaire. À revérifier sur une publication plus récente de l''Agence des forêts (林野庁) si possible.'
from (values
  ('Yamaguchi', 71.54), ('Shimane', 78.35), ('Tottori', 73.83), ('Okayama', 68.02),
  ('Ehime', 70.64), ('Tokushima', 75.69), ('Oita', 71.53), ('Kumamoto', 62.64),
  ('Kagoshima', 63.58), ('Miyazaki', 76.25), ('Gifu', 81.12), ('Nagano', 78.87),
  ('Wakayama', 76.81), ('Niigata', 68.10), ('Aomori', 66.07), ('Hokkaido', 70.68)
) as v(name, pct)
join regions r on r.name = v.name;

-- ============================================================
-- shinkansen_station_count
-- Méthode : comptage manuel des gares Shinkansen situées dans la
-- préfecture, à partir des tableaux de gares (par ligne) de Wikipedia,
-- vérifiés individuellement ligne par ligne le 2026-09-11 :
-- San'yō, Kyūshū, Tōhoku, Jōetsu, Hokuriku, Hokkaidō, Tōkaidō Shinkansen.
-- 0 = aucune ligne Shinkansen ne dessert la préfecture (vérifié, pas
-- une absence de recherche).
-- ============================================================

insert into region_attributes (region_id, attribute_key, value_type, value_numeric, source_name, source_url, verified_at, confidence, notes)
select r.id, 'shinkansen_station_count', 'integer', v.count,
  'Wikipedia — comptage manuel sur les tableaux de gares par ligne Shinkansen',
  'https://en.wikipedia.org/wiki/Shinkansen',
  '2026-09-11', 'verified',
  v.notes
from (values
  ('Yamaguchi', 5, 'San''yō Shinkansen : Shin-Iwakuni, Tokuyama, Shin-Yamaguchi, Asa, Shin-Shimonoseki.'),
  ('Shimane', 0, 'Aucune ligne Shinkansen ne dessert la région San-in.'),
  ('Tottori', 0, 'Aucune ligne Shinkansen ne dessert la région San-in.'),
  ('Okayama', 2, 'San''yō Shinkansen : Okayama, Shin-Kurashiki.'),
  ('Ehime', 0, 'Shikoku : aucune ligne Shinkansen n''y circule.'),
  ('Tokushima', 0, 'Shikoku : aucune ligne Shinkansen n''y circule.'),
  ('Oita', 0, 'Non desservie par le Kyūshū Shinkansen ni aucune autre ligne.'),
  ('Kumamoto', 5, 'Kyūshū Shinkansen : Shin-Ōmuta, Shin-Tamana, Kumamoto, Shin-Yatsushiro, Chikugo-Funagoya.'),
  ('Kagoshima', 4, 'Kyūshū Shinkansen : Shin-Minamata, Izumi, Sendai, Kagoshima-Chūō.'),
  ('Miyazaki', 0, 'Non desservie par le Kyūshū Shinkansen ni aucune autre ligne.'),
  ('Gifu', 1, 'Tōkaidō Shinkansen : Gifu-Hashima.'),
  ('Nagano', 5, 'Hokuriku Shinkansen : Karuizawa, Sakudaira, Ueda, Nagano, Iiyama.'),
  ('Wakayama', 0, 'Aucune ligne Shinkansen ; la préfecture est desservie par des lignes JR classiques uniquement.'),
  ('Niigata', 7, 'Jōetsu Shinkansen (5 : Echigo-Yuzawa, Urasa, Nagaoka, Tsubame-Sanjō, Niigata) + Hokuriku Shinkansen (2 : Jōetsumyōkō, Itoigawa).'),
  ('Aomori', 4, 'Tōhoku Shinkansen (Hachinohe, Shichinohe-Towada, Shin-Aomori) + Hokkaidō Shinkansen (Okutsugaru-Imabetsu ; Shin-Aomori est la même gare que sur la ligne Tōhoku, non recomptée).'),
  ('Hokkaido', 2, 'Hokkaidō Shinkansen : Kikonai, Shin-Hakodate-Hokuto (Shin-Otaru, Shin-Yakumo et le terminus de Sapporo sont en construction, non comptés).')
) as v(name, count, notes)
join regions r on r.name = v.name;

-- ============================================================
-- avg_annual_snowfall_cm
-- Source : Current Results, moyennes annuelles compilant les normales
-- climatiques JMA pour la ville-préfecture (chef-lieu), même méthode
-- pour toutes les régions.
-- https://www.currentresults.com/Weather/Japan/snowfall-annual-average.php
-- Source secondaire (agrégateur des normales JMA, pas le site JMA
-- directement) -> confidence='estimated'.
-- ============================================================

insert into region_attributes (region_id, attribute_key, value_type, value_numeric, source_name, source_url, verified_at, confidence, notes)
select r.id, 'avg_annual_snowfall_cm', 'numeric', v.cm,
  'Current Results — Average Annual Snowfall (compile les normales climatiques JMA)',
  'https://www.currentresults.com/Weather/Japan/snowfall-annual-average.php',
  '2026-09-11', 'estimated',
  'Mesuré à la station de la ville-préfecture (chef-lieu) : ' || v.city || '. Le chef-lieu n''est pas toujours représentatif de toute la préfecture (micro-climats de montagne notamment).'
from (values
  ('Yamaguchi', 23, 'Yamaguchi'), ('Shimane', 89, 'Matsue'), ('Tottori', 214, 'Tottori'),
  ('Okayama', 3, 'Okayama'), ('Ehime', 2, 'Matsuyama'), ('Tokushima', 4, 'Tokushima'),
  ('Oita', 2, 'Oita'), ('Kumamoto', 2, 'Kumamoto'), ('Kagoshima', 4, 'Kagoshima'),
  ('Miyazaki', 0, 'Miyazaki'), ('Gifu', 47, 'Gifu'), ('Nagano', 263, 'Nagano'),
  ('Wakayama', 2, 'Wakayama'), ('Niigata', 217, 'Niigata'), ('Aomori', 669, 'Aomori'),
  ('Hokkaido', 597, 'Sapporo')
) as v(name, cm, city)
join regions r on r.name = v.name;

-- ============================================================
-- Fukuoka_Periph / Hyogo_Rural : mêmes réserves que dans la migration
-- précédente — pas des préfectures officielles, aucune source ne
-- peut leur être rattachée sans hypothèse arbitraire.
-- ============================================================

insert into region_attributes (region_id, attribute_key, value_type, value_numeric, source_name, source_url, verified_at, confidence, notes)
select r.id, attr.key, attr.value_type, null,
  'Aucune — zone non officielle', null, '2026-09-11', 'unknown',
  'Cette zone n''est pas une préfecture administrative japonaise officielle (sous-zone créée pour l''application) : aucune source ne permet de déterminer cet attribut sans hypothèse arbitraire.'
from regions r
cross join (values
  ('forest_area_percent', 'numeric'),
  ('shinkansen_station_count', 'integer'),
  ('avg_annual_snowfall_cm', 'numeric')
) as attr(key, value_type)
where r.name in ('Fukuoka_Periph', 'Hyogo_Rural');
