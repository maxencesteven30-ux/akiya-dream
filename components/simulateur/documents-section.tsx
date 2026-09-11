"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PIECE_CATEGORY_LABELS,
  deleteProjectDocument,
  fetchProjectDocuments,
  getDocumentSignedUrl,
  uploadProjectDocument,
  validateDocumentFile,
  type PieceCategory,
  type ProjectDocument,
} from "@/lib/documents";

interface DocumentsSectionProps {
  projectId: number;
}

const CATEGORY_OPTIONS: PieceCategory[] = [
  "annonce",
  "photo",
  "devis",
  "diagnostic",
  "cadastre",
  "autre",
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DocumentsSection({ projectId }: DocumentsSectionProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<PieceCategory>("photo");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loading = !loaded && !error;

  useEffect(() => {
    let ignore = false;
    fetchProjectDocuments(projectId)
      .then((docs) => {
        if (!ignore) {
          setDocuments(docs);
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : "Erreur inconnue.");
      });
    return () => {
      ignore = true;
    };
  }, [projectId]);

  const handleUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      return;
    }

    setUploading(true);
    setUploadError(null);
    uploadProjectDocument(projectId, file, category, note.trim() || null)
      .then((doc) => {
        setDocuments((prev) => [doc, ...prev]);
        setNote("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      })
      .catch((err: unknown) => {
        setUploadError(err instanceof Error ? err.message : "Erreur inconnue.");
      })
      .finally(() => setUploading(false));
  };

  const handleView = (document: ProjectDocument) => {
    getDocumentSignedUrl(document.storagePath)
      .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erreur inconnue.");
      });
  };

  const handleDelete = (document: ProjectDocument) => {
    setDocuments((prev) => prev.filter((d) => d.id !== document.id));
    deleteProjectDocument(document).catch((err: unknown) => {
      console.error("Failed to delete document:", err);
    });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          📎 Pièces et preuves
        </h2>
      </div>
      <p className="mb-5 text-lg text-foreground">
        Annonce, photos, devis, diagnostics, cadastre — rassemblés au même endroit
      </p>

      <Card className="border-border p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm">Type de pièce</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v as PieceCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: PieceCategory) => PIECE_CATEGORY_LABELS[value] ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {PIECE_CATEGORY_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Note (optionnel)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Devis toiture" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="text-sm"
          />
          <Button size="sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Envoi..." : "Envoyer"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Images (JPG/PNG/WEBP) ou PDF, 10 Mo maximum par fichier.
        </p>
        {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}
      </Card>

      <Card className="mt-4 border-border p-6 sm:p-8">
        {loading && <p className="text-sm text-muted-foreground">Chargement...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && documents.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune pièce ajoutée pour l&apos;instant.</p>
        )}
        {documents.length > 0 && (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {PIECE_CATEGORY_LABELS[doc.category]} — {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(doc.sizeBytes)}
                    {doc.note ? ` · ${doc.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleView(doc)}>
                    Voir
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => handleDelete(doc)}
                  >
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.section>
  );
}
