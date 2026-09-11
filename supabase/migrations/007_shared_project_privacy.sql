-- Akiya Dream — durcissement de la confidentialité du partage (Phase T, audit
-- de production).
--
-- Constat de l'audit : get_shared_project(token) faisait "select * from
-- projects", donc renvoyait aussi capital_disponible_eur et
-- reserve_securite_eur (le budget personnel du propriétaire) à quiconque
-- possède le lien de partage. La page de partage n'affiche jamais ces deux
-- champs, mais ils transitaient quand même sur le réseau jusqu'au
-- navigateur du destinataire (visibles via les outils de développement) :
-- ce n'est pas un problème d'affichage, c'est un problème de transit.
--
-- Correctif : la fonction ne sélectionne plus ces deux colonnes — elle
-- renvoie null à leur place, directement au niveau SQL. Rien de plus n'est
-- envoyé sur le réseau, la page de partage se comporte à l'identique (elle
-- ne les utilisait déjà pas).
--
-- À exécuter manuellement dans l'éditeur SQL Supabase, après 006.

drop function if exists get_shared_project(text);

create function get_shared_project(token text)
returns table (
  id bigint,
  user_id uuid,
  name text,
  profile text,
  house_price_jpy numeric,
  prefecture text,
  renovation_level text,
  capital_disponible_eur numeric,
  reserve_securite_eur numeric,
  real_listing jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  share_token text
)
language sql
security definer
set search_path = public
as $$
  select
    id,
    user_id,
    name,
    profile,
    house_price_jpy,
    prefecture,
    renovation_level,
    null::numeric as capital_disponible_eur,
    null::numeric as reserve_securite_eur,
    real_listing,
    created_at,
    updated_at,
    share_token
  from projects
  where share_token = token;
$$;

grant execute on function get_shared_project(text) to anon, authenticated;
