-- Akiya Dream — partage de projet par lien (Phase 11, reconstruite sur
-- Supabase plutôt que Firebase : un seul système d'auth/persistance dans
-- l'app, pas deux en parallèle pour la même chose).
--
-- Choix architectural assumé : le cahier des charges demandait un partage
-- "par email", mais l'app utilise l'authentification anonyme (pas d'email
-- associé aux utilisateurs, et aucun service d'envoi d'email transactionnel
-- n'existe dans ce projet). On implémente donc un partage PAR LIEN (comme
-- Google Docs/Figma) : un jeton aléatoire non devinable, transmis par
-- l'utilisateur lui-même (copier/coller le lien) plutôt que par email
-- automatique.
--
-- Sécurité : la RLS de la table `projects` reste strictement limitée au
-- propriétaire (auth.uid() = user_id) — AUCUNE policy permissive n'est
-- ajoutée dessus. La lecture d'un projet partagé passe exclusivement par
-- la fonction get_shared_project(token), SECURITY DEFINER, qui exige une
-- correspondance EXACTE du jeton (pas juste "un jeton existe") : impossible
-- de lister les projets partagés d'autrui sans connaître leur lien précis.
--
-- À exécuter manuellement dans l'éditeur SQL Supabase, après la migration
-- 004_projects.sql.

alter table projects add column if not exists share_token text unique;

create or replace function get_shared_project(token text)
returns setof projects
language sql
security definer
set search_path = public
as $$
  select * from projects where share_token = token;
$$;

grant execute on function get_shared_project(text) to anon, authenticated;
