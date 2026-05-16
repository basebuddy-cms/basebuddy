import { describe, expect, it } from "vitest";

import {
  MAX_FILE_UPLOAD_BYTES,
  MAX_MEDIA_UPLOAD_BYTES,
  validateFileUpload,
  validateFileUploadMetadata,
  validateImageUploadFile,
  validateImageUploadMetadata,
} from "@/lib/security/upload-validation";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 demo");
const SVG_BYTES = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

describe("upload validation", () => {
  it("accepts supported image uploads by file signature", async () => {
    const file = new File([PNG_BYTES], "hero.png", {
      type: "application/octet-stream",
    });

    const result = await validateImageUploadFile({
      file,
      label: "Image upload",
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
    });

    expect(result.contentType).toBe("image/png");
    expect(result.bytes).toEqual(PNG_BYTES);
  });

  it("rejects svg image uploads", async () => {
    const file = new File([SVG_BYTES], "vector.svg", {
      type: "image/svg+xml",
    });

    await expect(
      validateImageUploadFile({
        file,
        label: "Image upload",
        maxBytes: MAX_MEDIA_UPLOAD_BYTES,
      }),
    ).rejects.toThrow("SVG uploads are not allowed.");
  });

  it("accepts supported image upload metadata without reading file bytes", () => {
    const result = validateImageUploadMetadata({
      contentType: "",
      fileName: "hero.jpg",
      label: "Image upload",
      maxBytes: MAX_MEDIA_UPLOAD_BYTES,
      sizeBytes: 128,
    });

    expect(result.contentType).toBe("image/jpeg");
  });

  it("rejects image payloads in the files library", async () => {
    const file = new File([PNG_BYTES], "not-a-document.pdf", {
      type: "application/pdf",
    });

    await expect(
      validateFileUpload({
        file,
        label: "File upload",
        maxBytes: MAX_FILE_UPLOAD_BYTES,
      }),
    ).rejects.toThrow("Image files belong in the media library. Upload them from Media instead.");
  });

  it("rejects image-like file metadata in the files library", () => {
    expect(() =>
      validateFileUploadMetadata({
        contentType: "image/png",
        fileName: "diagram.pdf",
        label: "File upload",
        maxBytes: MAX_FILE_UPLOAD_BYTES,
        sizeBytes: 128,
      }),
    ).toThrow("Image files belong in the media library. Upload them from Media instead.");
  });

  it("accepts known document uploads", async () => {
    const file = new File([PDF_BYTES], "spec.pdf", {
      type: "application/pdf",
    });

    const result = await validateFileUpload({
      file,
      label: "File upload",
      maxBytes: MAX_FILE_UPLOAD_BYTES,
    });

    expect(result.contentType).toBe("application/pdf");
  });
});
