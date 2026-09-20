import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  filterStateForUser,
  isClientEventType,
  normalizePageNumber,
  passwordFingerprint,
  publicUser,
  sanitizeEventMetadata,
  trimEventsForLink,
  validateShareLink,
  verifyLinkPassword,
} from "./state-access";
import { emptyState } from "./local-product";
import type {
  AppUser,
  FileAsset,
  LocalState,
  ShareLink,
  TrackingEvent,
} from "./local-product";

function user(id: string, email: string): AppUser {
  return {
    id,
    firebaseUid: `uid_${id}`,
    name: id,
    email,
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function file(id: string, ownerUserId: string): FileAsset {
  return {
    id,
    ownerUserId,
    name: `${id}.pdf`,
    type: "application/pdf",
    kind: "pdf",
    size: 10,
    storagePath: `files/${id}`,
    pageCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function link(id: string, fileId: string, ownerUserId: string, extra: Partial<ShareLink> = {}): ShareLink {
  return {
    id,
    ownerUserId,
    fileId,
    token: `share_${id}`,
    title: id,
    enabled: true,
    allowDownload: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

function fixture(): LocalState {
  return {
    ...emptyState(),
    users: [user("alice", "alice@example.com"), user("bob", "bob@example.com")],
    authSessions: [
      {
        id: "auth_1",
        userId: "alice",
        tokenHash: "hash",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2030-01-01T00:00:00.000Z",
      },
    ],
    files: [file("file_a", "alice"), file("file_b", "bob")],
    links: [link("link_a", "file_a", "alice"), link("link_b", "file_b", "bob")],
    sessions: [
      {
        id: "ses_a",
        linkId: "link_a",
        fileId: "file_a",
        startedAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        userAgent: "test",
        passwordFingerprint: passwordFingerprint(undefined),
      },
      {
        id: "ses_b",
        linkId: "link_b",
        fileId: "file_b",
        startedAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        userAgent: "test",
        passwordFingerprint: passwordFingerprint(undefined),
      },
    ],
    events: [
      {
        id: "evt_a",
        linkId: "link_a",
        fileId: "file_a",
        sessionId: "ses_a",
        eventType: "page_viewed",
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "evt_b",
        linkId: "link_b",
        fileId: "file_b",
        sessionId: "ses_b",
        eventType: "page_viewed",
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("filterStateForUser", () => {
  test("returns only the requesting owner's rows", () => {
    const scoped = filterStateForUser(fixture(), "alice");

    assert.deepEqual(scoped.files.map((item) => item.id), ["file_a"]);
    assert.deepEqual(scoped.links.map((item) => item.id), ["link_a"]);
    assert.deepEqual(scoped.sessions.map((item) => item.id), ["ses_a"]);
    assert.deepEqual(scoped.events.map((item) => item.id), ["evt_a"]);
  });

  test("never exposes the user table or any session token", () => {
    const scoped = filterStateForUser(fixture(), "alice");
    assert.deepEqual(scoped.users, []);
    assert.deepEqual(scoped.authSessions, []);
    assert.equal(JSON.stringify(scoped).includes("bob@example.com"), false);
  });

  test("an unknown user sees nothing", () => {
    const scoped = filterStateForUser(fixture(), "nobody");
    assert.deepEqual(scoped.files, []);
    assert.deepEqual(scoped.links, []);
  });
});

describe("validateShareLink", () => {
  test("accepts a live link", () => {
    const result = validateShareLink(fixture(), "share_link_a");
    assert.equal(result.ok, true);
  });

  test("rejects unknown, disabled and expired links", () => {
    const state = fixture();
    assert.equal(validateShareLink(state, "share_nope").ok, false);

    state.links[0].enabled = false;
    assert.equal(validateShareLink(state, "share_link_a").ok, false);

    state.links[0].enabled = true;
    state.links[0].expiresAt = "2026-01-02T00:00:00.000Z";
    assert.equal(
      validateShareLink(state, "share_link_a", new Date("2026-01-03T00:00:00.000Z")).ok,
      false,
    );
  });

  test("rejects a link whose file is gone", () => {
    const state = fixture();
    state.files = state.files.filter((item) => item.id !== "file_a");
    assert.equal(validateShareLink(state, "share_link_a").ok, false);
  });
});

describe("link passwords", () => {
  test("an unprotected link accepts any request", () => {
    assert.equal(verifyLinkPassword(link("l", "f", "u"), undefined), true);
  });

  test("only the right password passes", () => {
    const protectedLink = link("l", "f", "u", { password: "open sesame" });
    assert.equal(verifyLinkPassword(protectedLink, "open sesame"), true);
    assert.equal(verifyLinkPassword(protectedLink, "open sesam"), false);
    assert.equal(verifyLinkPassword(protectedLink, ""), false);
    assert.equal(verifyLinkPassword(protectedLink, undefined), false);
  });

  test("the fingerprint changes when the password does, revoking old grants", () => {
    const before = passwordFingerprint("one");
    assert.equal(passwordFingerprint("one"), before);
    assert.notEqual(passwordFingerprint("two"), before);
    assert.notEqual(passwordFingerprint(undefined), before);
  });
});

describe("event intake", () => {
  test("only viewer-reportable event types are accepted", () => {
    assert.equal(isClientEventType("page_viewed"), true);
    assert.equal(isClientEventType("download_clicked"), true);
    assert.equal(isClientEventType("viewer_closed"), true);
    // Server-issued types must not be forgeable by a viewer.
    assert.equal(isClientEventType("link_blocked"), false);
    assert.equal(isClientEventType("viewer_started"), false);
    assert.equal(isClientEventType("link_opened"), false);
    assert.equal(isClientEventType(""), false);
  });

  test("page numbers outside the document are dropped", () => {
    assert.equal(normalizePageNumber(2, 3), 2);
    assert.equal(normalizePageNumber(0, 3), undefined);
    assert.equal(normalizePageNumber(4, 3), undefined);
    assert.equal(normalizePageNumber(1.5, 3), undefined);
    assert.equal(normalizePageNumber("2", 3), undefined);
  });

  test("metadata is reduced to short primitive values under safe keys", () => {
    const cleaned = sanitizeEventMetadata({
      viewport: "1024x768",
      count: 3,
      flag: true,
      "bad key!": "dropped",
      nested: { a: 1 },
      long: "x".repeat(500),
    });

    assert.equal(cleaned?.viewport, "1024x768");
    assert.equal(cleaned?.count, 3);
    assert.equal(cleaned?.flag, true);
    assert.equal("bad key!" in (cleaned ?? {}), false);
    assert.equal("nested" in (cleaned ?? {}), false);
    assert.equal((cleaned?.long as string).length, 120);
  });

  test("non-objects yield no metadata", () => {
    assert.equal(sanitizeEventMetadata("nope"), undefined);
    assert.equal(sanitizeEventMetadata([1, 2]), undefined);
    assert.equal(sanitizeEventMetadata(null), undefined);
  });
});

describe("trimEventsForLink", () => {
  test("caps one link's events while leaving other links alone", () => {
    const events: TrackingEvent[] = [
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `a${index}`,
        linkId: "link_a",
        fileId: "file_a",
        sessionId: "ses_a",
        eventType: "page_viewed" as const,
        occurredAt: "2026-01-01T00:00:00.000Z",
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `b${index}`,
        linkId: "link_b",
        fileId: "file_b",
        sessionId: "ses_b",
        eventType: "page_viewed" as const,
        occurredAt: "2026-01-01T00:00:00.000Z",
      })),
    ];

    const trimmed = trimEventsForLink(events, "link_a", 2);

    assert.deepEqual(
      trimmed.filter((event) => event.linkId === "link_a").map((event) => event.id),
      ["a0", "a1"],
    );
    assert.equal(trimmed.filter((event) => event.linkId === "link_b").length, 4);
  });
});

describe("publicUser", () => {
  test("exposes only presentational fields", () => {
    assert.deepEqual(publicUser(user("alice", "alice@example.com")), {
      id: "alice",
      name: "alice",
      email: "alice@example.com",
      emailVerified: true,
      avatarUrl: undefined,
    });
  });
});
