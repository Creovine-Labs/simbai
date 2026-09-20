import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyLinkPatch,
  fromDateTimeLocalValue,
  getFileKind,
  isExpired,
  publicLink,
  toDateTimeLocalValue,
} from "./local-product";
import type { ShareLink } from "./local-product";

function makeLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: "link_1",
    ownerUserId: "user_1",
    fileId: "file_1",
    token: "share_1",
    title: "Original title",
    enabled: true,
    password: "s3cr3t",
    expiresAt: "2030-01-01T00:00:00.000Z",
    allowDownload: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("applyLinkPatch", () => {
  test("a partial patch leaves every other field untouched", () => {
    const updated = applyLinkPatch(makeLink(), { title: "Renamed" });

    assert.equal(updated.title, "Renamed");
    // The previous build spread `undefined` over these and silently killed links.
    assert.equal(updated.enabled, true);
    assert.equal(updated.password, "s3cr3t");
    assert.equal(updated.allowDownload, true);
    assert.equal(updated.expiresAt, "2030-01-01T00:00:00.000Z");
  });

  test("toggling one flag does not disturb the title", () => {
    const updated = applyLinkPatch(makeLink(), { allowDownload: false });
    assert.equal(updated.allowDownload, false);
    assert.equal(updated.title, "Original title");
  });

  test("null clears the optional fields", () => {
    const updated = applyLinkPatch(makeLink(), { password: null, expiresAt: null });
    assert.equal("password" in updated, false);
    assert.equal("expiresAt" in updated, false);
  });

  test("an empty string also clears a password", () => {
    const updated = applyLinkPatch(makeLink(), { password: "" });
    assert.equal("password" in updated, false);
  });

  test("expiry is normalised to a UTC instant", () => {
    const updated = applyLinkPatch(makeLink(), {
      expiresAt: "2030-06-01T12:00:00+02:00",
    });
    assert.equal(updated.expiresAt, "2030-06-01T10:00:00.000Z");
  });

  test("rejects wrongly typed and empty values", () => {
    assert.throws(() => applyLinkPatch(makeLink(), { enabled: "yes" }));
    assert.throws(() => applyLinkPatch(makeLink(), { title: 42 }));
    assert.throws(() => applyLinkPatch(makeLink(), { title: "   " }));
    assert.throws(() => applyLinkPatch(makeLink(), { expiresAt: "not a date" }));
    assert.throws(() => applyLinkPatch(makeLink(), null));
  });

  test("ignores keys that are not part of the link contract", () => {
    const updated = applyLinkPatch(makeLink(), {
      ownerUserId: "attacker",
      token: "share_stolen",
      fileId: "file_other",
    });

    assert.equal(updated.ownerUserId, "user_1");
    assert.equal(updated.token, "share_1");
    assert.equal(updated.fileId, "file_1");
  });
});

describe("publicLink", () => {
  test("never carries the password to a viewer", () => {
    const shaped = publicLink(makeLink());
    assert.equal("password" in shaped, false);
    assert.equal("ownerUserId" in shaped, false);
    assert.equal(shaped.passwordRequired, true);
    assert.equal(JSON.stringify(shaped).includes("s3cr3t"), false);
  });

  test("reports when no password is set", () => {
    assert.equal(publicLink(makeLink({ password: undefined })).passwordRequired, false);
  });
});

describe("expiry", () => {
  test("compares against a stored UTC instant", () => {
    const link = makeLink({ expiresAt: "2026-05-01T10:00:00.000Z" });
    assert.equal(isExpired(link, new Date("2026-05-01T09:59:00.000Z")), false);
    assert.equal(isExpired(link, new Date("2026-05-01T10:01:00.000Z")), true);
  });

  test("a link without an expiry never expires", () => {
    assert.equal(isExpired(makeLink({ expiresAt: undefined })), false);
  });

  test("datetime-local round trips through the same wall-clock time", () => {
    const local = "2030-03-04T17:45";
    const iso = fromDateTimeLocalValue(local);
    assert.ok(iso);
    assert.equal(toDateTimeLocalValue(iso), local);
  });

  test("blank and malformed local values become null", () => {
    assert.equal(fromDateTimeLocalValue(""), null);
    assert.equal(fromDateTimeLocalValue("nonsense"), null);
    assert.equal(toDateTimeLocalValue(undefined), "");
  });
});

describe("getFileKind", () => {
  test("accepts PDFs and raster images", () => {
    assert.equal(getFileKind("application/pdf"), "pdf");
    assert.equal(getFileKind("image/png"), "image");
    assert.equal(getFileKind("image/webp"), "image");
  });

  test("rejects SVG, which is a scriptable document", () => {
    assert.equal(getFileKind("image/svg+xml"), null);
  });

  test("rejects everything else", () => {
    assert.equal(getFileKind("text/html"), null);
    assert.equal(getFileKind("application/octet-stream"), null);
  });
});
