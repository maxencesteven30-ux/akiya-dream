import { getSupabaseClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/data";

// Phase O — Gestion des pièces et preuves d'un projet.
//
// Bucket privé Supabase Storage ("project-documents") + table de
// métadonnées (project_documents), cf. supabase/migrations/006_project_documents.sql.
// Un document ne peut être attaché qu'à un projet déjà sauvegardé (avec un
// id Supabase), jamais à une session en cours : c'est le choix
// d'architecture validé avec l'utilisateur pour la Phase O.

export type PieceCategory = "annonce" | "photo" | "devis" | "diagnostic" | "cadastre" | "autre";

export const PIECE_CATEGORY_LABELS: Record<PieceCategory, string> = {
  annonce: "Annonce",
  photo: "Photo",
  devis: "Devis",
  diagnostic: "Diagnostic",
  cadastre: "Cadastre",
  autre: "Autre",
};

// Règle de gestion explicite validée avec l'utilisateur (Phase O), pas une
// limite technique de Supabase : images courantes + PDF, 10 Mo par fichier.
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export interface FileValidationResult {
  valid: boolean;
  error: string | null;
}

// Validation côté client, en plus de la limite déjà posée sur le bucket
// Supabase (defense in depth) : un fichier refusé ici ne déclenche même pas
// d'appel réseau, et le message est plus clair pour l'utilisateur qu'une
// erreur Storage brute.
export function validateDocumentFile(file: { size: number; type: string }): FileValidationResult {
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { valid: false, error: "Fichier trop volumineux (10 Mo maximum)." };
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
    return { valid: false, error: "Format non accepté (images JPG/PNG/WEBP ou PDF uniquement)." };
  }
  return { valid: true, error: null };
}

export interface ProjectDocument {
  id: number;
  projectId: number;
  storagePath: string;
  fileName: string;
  category: PieceCategory;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: string;
}

interface ProjectDocumentRow {
  id: number;
  project_id: number;
  storage_path: string;
  file_name: string;
  category: PieceCategory;
  content_type: string;
  size_bytes: number;
  note: string | null;
  created_at: string;
}

function mapDocumentRow(row: ProjectDocumentRow): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    category: row.category,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    note: row.note,
    createdAt: row.created_at,
  };
}

const BUCKET = "project-documents";

export async function fetchProjectDocuments(projectId: number): Promise<ProjectDocument[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("project_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .returns<ProjectDocumentRow[]>();

    if (error) throw error;
    return (data ?? []).map(mapDocumentRow);
  } catch (error) {
    console.error("fetchProjectDocuments failed:", error);
    throw new Error("Impossible de charger les pièces de ce projet.");
  }
}

export async function uploadProjectDocument(
  projectId: number,
  file: File,
  category: PieceCategory,
  note: string | null,
): Promise<ProjectDocument> {
  const validation = validateDocumentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error ?? "Fichier invalide.");
  }

  try {
    const userId = await requireUserId();
    const storagePath = `${userId}/${projectId}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await getSupabaseClient()
      .storage.from(BUCKET)
      .upload(storagePath, file, { contentType: file.type });
    if (uploadError) throw uploadError;

    const { data, error } = await getSupabaseClient()
      .from("project_documents")
      .insert({
        project_id: projectId,
        user_id: userId,
        storage_path: storagePath,
        file_name: file.name,
        category,
        content_type: file.type,
        size_bytes: file.size,
        note,
      })
      .select()
      .returns<ProjectDocumentRow[]>()
      .single();

    if (error) {
      // La ligne de métadonnées a échoué après un upload réussi : on retire
      // le fichier orphelin plutôt que de laisser un objet Storage sans
      // trace, invisible dans l'UI mais qui continue de consommer le quota.
      await getSupabaseClient().storage.from(BUCKET).remove([storagePath]);
      throw error;
    }
    return mapDocumentRow(data);
  } catch (error) {
    console.error("uploadProjectDocument failed:", error);
    throw error instanceof Error ? error : new Error("Impossible d'envoyer ce fichier.");
  }
}

export async function deleteProjectDocument(document: ProjectDocument): Promise<void> {
  try {
    const { error: storageError } = await getSupabaseClient()
      .storage.from(BUCKET)
      .remove([document.storagePath]);
    if (storageError) throw storageError;

    const { error } = await getSupabaseClient()
      .from("project_documents")
      .delete()
      .eq("id", document.id);
    if (error) throw error;
  } catch (error) {
    console.error("deleteProjectDocument failed:", error);
    throw new Error("Impossible de supprimer cette pièce.");
  }
}

// Bucket privé : pas d'URL publique, seulement des URLs signées à durée
// limitée (1h), générées à la demande plutôt que stockées.
export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data) {
    throw new Error("Impossible de générer le lien de ce fichier.");
  }
  return data.signedUrl;
}
