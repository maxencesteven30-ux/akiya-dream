-- Akiya Dream — pièces et preuves par projet (Phase O).
-- Bucket privé Supabase Storage + table de métadonnées, sur le même
-- modèle que projects (auth anonyme, RLS strict propriétaire-only).
--
-- À exécuter manuellement dans l'éditeur SQL Supabase, après 004 et 005.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  10485760, -- 10 Mo, validé avec l'utilisateur (Phase O)
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Chaque fichier est stocké sous {user_id}/{project_id}/{uuid}-{nom}.
-- (storage.foldername(name))[1] est le premier segment du chemin, donc
-- l'user_id : la policy interdit tout accès à un fichier hors de son
-- propre dossier, sans dépendre de la table project_documents.
create policy "Users can read their own documents" on storage.objects
  for select using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload their own documents" on storage.objects
  for insert with check (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own documents" on storage.objects
  for delete using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists project_documents (
  id bigint generated always as identity primary key,
  project_id bigint not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  category text not null check (
    category in ('annonce', 'photo', 'devis', 'diagnostic', 'cadastre', 'autre')
  ),
  content_type text not null,
  size_bytes bigint not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists project_documents_project_id_idx on project_documents(project_id);

alter table project_documents enable row level security;

create policy "Users can view their own project documents" on project_documents
  for select using (auth.uid() = user_id);

create policy "Users can insert their own project documents" on project_documents
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own project documents" on project_documents
  for delete using (auth.uid() = user_id);
