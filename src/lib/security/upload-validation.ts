const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = ONE_KILOBYTE * ONE_KILOBYTE;

export const MAX_AVATAR_UPLOAD_BYTES = 5 * ONE_MEGABYTE;
export const MAX_MEDIA_UPLOAD_BYTES = 10 * ONE_MEGABYTE;
export const MAX_FILE_UPLOAD_BYTES = 25 * ONE_MEGABYTE;
export const MAX_MEDIA_UPLOAD_FILES = 10;
export const MAX_FILE_UPLOAD_FILES = 10;
export const MAX_MEDIA_UPLOAD_REQUEST_BYTES = 60 * ONE_MEGABYTE;
export const MAX_FILE_UPLOAD_REQUEST_BYTES = 130 * ONE_MEGABYTE;
export const MAX_PROFILE_UPLOAD_REQUEST_BYTES = 6 * ONE_MEGABYTE;

const ALLOWED_MEDIA_IMAGE_TYPES = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

const ALLOWED_MEDIA_IMAGE_EXTENSIONS = new Set([
  "avif",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp",
]);

const IMAGE_CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  avif: ALLOWED_MEDIA_IMAGE_TYPES.avif,
  gif: ALLOWED_MEDIA_IMAGE_TYPES.gif,
  jpeg: ALLOWED_MEDIA_IMAGE_TYPES.jpeg,
  jpg: ALLOWED_MEDIA_IMAGE_TYPES.jpeg,
  png: ALLOWED_MEDIA_IMAGE_TYPES.png,
  webp: ALLOWED_MEDIA_IMAGE_TYPES.webp,
};

const ALLOWED_FILE_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "gz",
  "json",
  "md",
  "pdf",
  "ppt",
  "pptx",
  "rtf",
  "tar",
  "txt",
  "xls",
  "xlsx",
  "xml",
  "zip",
]);

const FILE_CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gz: "application/gzip",
  json: "application/json",
  md: "text/markdown",
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  tar: "application/x-tar",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml",
  zip: "application/zip",
};

type ValidatedUploadFile = {
  bytes: Uint8Array;
  contentType: string;
};

type UploadMetadata = {
  contentType?: string | null;
  fileName: string;
  sizeBytes: number;
};

const decoder = new TextDecoder();

const getFileExtension = (fileName: string) => {
  const lastSegment = fileName.trim().split("/").pop() ?? "";
  const extension = lastSegment.includes(".") ? lastSegment.split(".").pop() : null;
  return extension?.toLowerCase() ?? "";
};

const startsWithBytes = (bytes: Uint8Array, signature: number[]) =>
  bytes.length >= signature.length &&
  signature.every((value, index) => bytes[index] === value);

const equalsAscii = (bytes: Uint8Array, offset: number, value: string) => {
  const slice = bytes.slice(offset, offset + value.length);
  return decoder.decode(slice) === value;
};

const looksLikeSvg = (bytes: Uint8Array) => {
  const sample = decoder.decode(bytes.slice(0, 512)).trim().toLowerCase();
  return sample.startsWith("<?xml") ? sample.includes("<svg") : sample.includes("<svg");
};

const detectImageKind = (bytes: Uint8Array) => {
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png" as const;
  }

  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg" as const;
  }

  if (equalsAscii(bytes, 0, "GIF87a") || equalsAscii(bytes, 0, "GIF89a")) {
    return "gif" as const;
  }

  if (equalsAscii(bytes, 0, "RIFF") && equalsAscii(bytes, 8, "WEBP")) {
    return "webp" as const;
  }

  if (
    equalsAscii(bytes, 4, "ftyp") &&
    (equalsAscii(bytes, 8, "avif") || equalsAscii(bytes, 8, "avis"))
  ) {
    return "avif" as const;
  }

  return null;
};

const assertUploadSize = ({
  label,
  maxBytes,
  sizeBytes,
}: {
  label: string;
  maxBytes: number;
  sizeBytes: number;
}) => {
  if (sizeBytes <= 0) {
    throw new Error(`${label} is empty.`);
  }

  if (sizeBytes > maxBytes) {
    throw new Error(`${label} must be ${Math.floor(maxBytes / ONE_MEGABYTE)} MB or smaller.`);
  }
};

const normalizeUploadMetadata = ({ contentType, fileName, sizeBytes }: UploadMetadata) => ({
  contentType: contentType?.trim().toLowerCase() ?? "",
  extension: getFileExtension(fileName),
  fileName,
  sizeBytes,
});

export const validateImageUploadMetadata = ({
  contentType,
  fileName,
  label,
  maxBytes,
  sizeBytes,
}: UploadMetadata & {
  label: string;
  maxBytes: number;
}) => {
  assertUploadSize({
    label,
    maxBytes,
    sizeBytes,
  });

  const normalized = normalizeUploadMetadata({
    contentType,
    fileName,
    sizeBytes,
  });

  if (normalized.extension === "svg" || normalized.contentType === "image/svg+xml") {
    throw new Error("SVG uploads are not allowed.");
  }

  const detectedContentType =
    Object.values(ALLOWED_MEDIA_IMAGE_TYPES).find((value) => value === normalized.contentType) ?? null;

  if (normalized.extension && !ALLOWED_MEDIA_IMAGE_EXTENSIONS.has(normalized.extension)) {
    throw new Error(`${label} must use a supported image extension.`);
  }

  if (!detectedContentType && !normalized.extension) {
    throw new Error(`${label} must be a PNG, JPEG, GIF, WebP, or AVIF image.`);
  }

  return {
    contentType:
      detectedContentType ??
      IMAGE_CONTENT_TYPE_BY_EXTENSION[normalized.extension],
  };
};

export const validateFileUploadMetadata = ({
  contentType,
  fileName,
  label,
  maxBytes,
  sizeBytes,
}: UploadMetadata & {
  label: string;
  maxBytes: number;
}) => {
  assertUploadSize({
    label,
    maxBytes,
    sizeBytes,
  });

  const normalized = normalizeUploadMetadata({
    contentType,
    fileName,
    sizeBytes,
  });

  if (!normalized.extension || !ALLOWED_FILE_EXTENSIONS.has(normalized.extension)) {
    throw new Error(
      "Files must be one of: csv, doc, docx, gz, json, md, pdf, ppt, pptx, rtf, tar, txt, xls, xlsx, xml, or zip.",
    );
  }

  if (normalized.contentType === "image/svg+xml" || normalized.contentType.startsWith("image/")) {
    throw new Error("Image files belong in the media library. Upload them from Media instead.");
  }

  return {
    contentType: FILE_CONTENT_TYPES[normalized.extension] ?? (normalized.contentType || "application/octet-stream"),
  };
};

export const validateImageUploadFile = async ({
  file,
  label,
  maxBytes,
}: {
  file: File;
  label: string;
  maxBytes: number;
}): Promise<ValidatedUploadFile> => {
  validateImageUploadMetadata({
    contentType: file.type,
    fileName: file.name,
    label,
    maxBytes,
    sizeBytes: file.size,
  });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = getFileExtension(file.name);

  if (extension === "svg" || file.type === "image/svg+xml" || looksLikeSvg(bytes)) {
    throw new Error("SVG uploads are not allowed.");
  }

  const imageKind = detectImageKind(bytes);

  if (!imageKind) {
    throw new Error(`${label} must be a PNG, JPEG, GIF, WebP, or AVIF image.`);
  }

  if (extension && !ALLOWED_MEDIA_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`${label} must use a supported image extension.`);
  }

  return {
    bytes,
    contentType: ALLOWED_MEDIA_IMAGE_TYPES[imageKind],
  };
};

export const validateFileUpload = async ({
  file,
  label,
  maxBytes,
}: {
  file: File;
  label: string;
  maxBytes: number;
}): Promise<ValidatedUploadFile> => {
  const metadataResult = validateFileUploadMetadata({
    contentType: file.type,
    fileName: file.name,
    label,
    maxBytes,
    sizeBytes: file.size,
  });

  const extension = getFileExtension(file.name);

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (looksLikeSvg(bytes) || detectImageKind(bytes)) {
    throw new Error("Image files belong in the media library. Upload them from Media instead.");
  }

  if (extension === "pdf" && !equalsAscii(bytes, 0, "%PDF")) {
    throw new Error("PDF uploads must have valid PDF file contents.");
  }

  return {
    bytes,
    contentType: metadataResult.contentType,
  };
};
