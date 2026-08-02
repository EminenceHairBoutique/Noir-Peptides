import { test, expect, request as pwRequest } from "@playwright/test";

/**
 * Server-side gate coverage for the checkout + attestation endpoints.
 *
 * These assert the REAL locks (401 unauthenticated, 403 unattested, 400 on a
 * bad/stale attestation) and therefore need a running API with Supabase + Stripe
 * configured — which the static `vite preview` harness does not provide. Set
 * E2E_API_URL (and, for the attested-happy-path, E2E_USER_TOKEN /
 * E2E_ATTESTED_TOKEN) to run them against a deployed preview or a local
 * `node dev-server.js` with env wired.
 *
 * Without E2E_API_URL the whole suite is skipped so the default run stays green
 * and honest (no fabricated verification).
 */

const API_URL = process.env.E2E_API_URL;

test.describe("checkout + attestation server gates", () => {
  test.skip(
    !API_URL,
    "Set E2E_API_URL to a running API (with Supabase+Stripe) to exercise the server gates."
  );

  let api;
  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: API_URL });
  });
  test.afterAll(async () => {
    await api?.dispose();
  });

  test("checkout rejects an unauthenticated request with 401", async () => {
    const res = await api.post("/api/create-checkout-session", {
      data: {
        items: [{ slug: "bpc-157-5mg", quantity: 1 }],
        researchUseAcknowledged: true,
      },
    });
    expect(res.status()).toBe(401);
  });

  test("attestation rejects an unauthenticated request with 401", async () => {
    const res = await api.post("/api/attestation", {
      data: { version: "v1.0", statements: [], legalName: "Test" },
    });
    expect(res.status()).toBe(401);
  });

  test("checkout rejects an authenticated-but-unattested user with 403", async () => {
    test.skip(
      !process.env.E2E_USER_TOKEN,
      "Set E2E_USER_TOKEN to a signed-in but UNATTESTED user's bearer token."
    );
    const res = await api.post("/api/create-checkout-session", {
      headers: { Authorization: `Bearer ${process.env.E2E_USER_TOKEN}` },
      data: {
        items: [{ slug: "bpc-157-5mg", quantity: 1 }],
        researchUseAcknowledged: true,
      },
    });
    expect(res.status()).toBe(403);
  });

  test("attestation rejects a stale version / incomplete statements with 400", async () => {
    test.skip(
      !process.env.E2E_USER_TOKEN,
      "Set E2E_USER_TOKEN to any signed-in user's bearer token."
    );
    // Stale version.
    const stale = await api.post("/api/attestation", {
      headers: { Authorization: `Bearer ${process.env.E2E_USER_TOKEN}` },
      data: { version: "v0.0", statements: [], legalName: "Test Researcher" },
    });
    expect(stale.status()).toBe(400);

    // Current version but no statements affirmed.
    const incomplete = await api.post("/api/attestation", {
      headers: { Authorization: `Bearer ${process.env.E2E_USER_TOKEN}` },
      data: { version: "v1.0", statements: [], legalName: "Test Researcher" },
    });
    expect(incomplete.status()).toBe(400);
  });
});
