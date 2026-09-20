import { PDFDocument } from "pdf-lib";
import type { FileKind } from "./local-product";

export type SniffedType = {
  contentType: string;
  kind: FileKind;
};

type Signature = {
  contentType: string;
  kind: FileKind;
  matches: (bytes: Uint8Array) => boolean;
};

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0) {
  if (bytes.length < offset + prefix.length) return false;
  return prefix.every((byte, index) => bytes[offset + index] === byte);
}

const SIGNATURES: Signature[] = [
  {
    // "%PDF-"
    contentType: "application/pdf",
    kind: "pdf",
    matches: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
  {
    contentType: "image/png",
    kind: "image",
    matches: (bytes) =>
      startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    contentType: "image/jpeg",
    kind: "image",
    matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  {
    contentType: "image/gif",
    kind: "image",
    matches: (bytes) =>
      startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
      startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  },
  {
    // "RIFF" .... "WEBP"
    contentType: "image/webp",
    kind: "image",
    matches: (bytes) =>
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8),
  },
];

/**
 * Decides a file's type from its bytes rather than the browser-supplied MIME.
 * Anything not on this list — notably SVG, which is a scriptable document — is
 * rejected, so the content route can echo the result back safely.
 */
export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  const signature = SIGNATURES.find((item) => item.matches(bytes));
  return signature
    ? { contentType: signature.contentType, kind: signature.kind }
    : null;
}

export const ACCEPTED_CONTENT_TYPES = SIGNATURES.map(
  (signature) => signature.contentType,
);

export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return Math.max(document.getPageCount(), 1);
  } catch {
    // A page count is presentation detail; a malformed PDF still uploads.
    return 1;
  }
}

/**
 * RFC 6266 / RFC 5987 content disposition. The ASCII fallback is stripped of
 * quotes and control characters so the header can never be split.
 */
export function contentDisposition(filename: string, download: boolean) {
  const asciiFallback =
    filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file";
  const encoded = encodeURIComponent(filename);
  const type = download ? "attachment" : "inline";
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
