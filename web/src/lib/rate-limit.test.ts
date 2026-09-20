import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clientKey, rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  test("allows up to the limit then blocks", () => {
    resetRateLimits();
    const now = 1_000_000;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal(rateLimit("k", 3, 60_000, now).ok, true);
    }

    const blocked = rateLimit("k", 3, 60_000, now);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.retryAfterSeconds, 60);
  });

  test("the window reopens once it elapses", () => {
    resetRateLimits();
    const now = 2_000_000;
    rateLimit("k", 1, 60_000, now);
    assert.equal(rateLimit("k", 1, 60_000, now).ok, false);
    assert.equal(rateLimit("k", 1, 60_000, now + 60_001).ok, true);
  });

  test("keys are counted independently", () => {
    resetRateLimits();
    const now = 3_000_000;
    assert.equal(rateLimit("a", 1, 60_000, now).ok, true);
    assert.equal(rateLimit("b", 1, 60_000, now).ok, true);
    assert.equal(rateLimit("a", 1, 60_000, now).ok, false);
  });
});

describe("clientKey", () => {
  test("uses the first forwarded address and namespaces by scope", () => {
    const request = new Request("https://example.test/", {
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" },
    });
    assert.equal(clientKey(request, "events"), "events:203.0.113.5");
  });

  test("falls back when no address is present", () => {
    assert.equal(clientKey(new Request("https://example.test/"), "events"), "events:unknown");
  });
});
