import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_SIZE_BYTES, validateDocumentFile } from "@/lib/documents";

describe("validateDocumentFile", () => {
  it("accepte un JPEG sous la limite de taille", () => {
    const result = validateDocumentFile({ size: 1_000_000, type: "image/jpeg" });
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("accepte un PDF sous la limite de taille", () => {
    const result = validateDocumentFile({ size: 5_000_000, type: "application/pdf" });
    expect(result.valid).toBe(true);
  });

  it("accepte un fichier pile à la limite de taille", () => {
    const result = validateDocumentFile({ size: MAX_DOCUMENT_SIZE_BYTES, type: "image/png" });
    expect(result.valid).toBe(true);
  });

  it("refuse un fichier dépassant la limite de taille", () => {
    const result = validateDocumentFile({
      size: MAX_DOCUMENT_SIZE_BYTES + 1,
      type: "image/png",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/volumineux/);
  });

  it("refuse un format non accepté", () => {
    const result = validateDocumentFile({ size: 1000, type: "application/msword" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/accepté/);
  });

  it("refuse une vidéo même de petite taille", () => {
    const result = validateDocumentFile({ size: 1000, type: "video/mp4" });
    expect(result.valid).toBe(false);
  });
});
