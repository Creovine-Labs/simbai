import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { contentDisposition, countPdfPages, sniffFileType } from "./file-type";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = new Uint8Array([...Buffer.from("GIF89a"), 0, 0]);
const WEBP = new Uint8Array([
  ...Buffer.from("RIFF"),
  0x1a,
  0,
  0,
  0,
  ...Buffer.from("WEBP"),
]);

async function makePdf(pages: number) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) document.addPage();
  return document.save();
}

describe("sniffFileType", () => {
  test("identifies the accepted formats from their bytes", () => {
    assert.equal(sniffFileType(PNG)?.contentType, "image/png");
    assert.equal(sniffFileType(JPEG)?.contentType, "image/jpeg");
    assert.equal(sniffFileType(GIF)?.contentType, "image/gif");
    assert.equal(sniffFileType(WEBP)?.contentType, "image/webp");
  });

  test("identifies a real PDF", async () => {
    const sniffed = sniffFileType(await makePdf(1));
    assert.equal(sniffed?.contentType, "application/pdf");
    assert.equal(sniffed?.kind, "pdf");
  });

  test("rejects SVG however it is labelled", () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    assert.equal(sniffFileType(svg), null);
  });

  test("rejects HTML and empty input", () => {
    assert.equal(sniffFileType(Buffer.from("<!doctype html><script>x</script>")), null);
    assert.equal(sniffFileType(new Uint8Array()), null);
  });

  test("a truncated RIFF header is not a WebP", () => {
    assert.equal(sniffFileType(new Uint8Array(Buffer.from("RIFF"))), null);
  });
});

describe("countPdfPages", () => {
  test("counts pages in a PDF that uses object streams", async () => {
    const bytes = await makePdf(9);
    assert.equal(await countPdfPages(bytes), 9);

    // The regex this replaced scanned raw bytes, so compressed page objects
    // were invisible to it and every such document reported a single page.
    const naive = Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page\b/g);
    assert.notEqual(naive?.length ?? 1, 9);
  });

  test("falls back to one page for bytes it cannot parse", async () => {
    assert.equal(await countPdfPages(Buffer.from("%PDF-1.7 broken")), 1);
  });
});

describe("contentDisposition", () => {
  test("switches between inline and attachment", () => {
    assert.match(contentDisposition("a.pdf", false), /^inline;/);
    assert.match(contentDisposition("a.pdf", true), /^attachment;/);
  });

  test("a filename cannot break out of the header", () => {
    const header = contentDisposition('evil"\r\nX-Injected: 1.pdf', false);
    assert.equal(header.includes("\r"), false);
    assert.equal(header.includes("\n"), false);
    assert.equal(header.split('"').length, 3);
  });

  test("non-ASCII names survive via the RFC 5987 parameter", () => {
    const header = contentDisposition("réunion.pdf", false);
    assert.ok(header.includes("filename*=UTF-8''r%C3%A9union.pdf"));
  });
});
