import assert from "node:assert/strict";
import test from "node:test";

import { getRepoMeta } from "../src/lib/projects.ts";

async function withMockFetch(
  mockFetch: typeof globalThis.fetch,
  callback: () => Promise<void>
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("getRepoMeta returns null for a genuine GitHub 404", async () => {
  await withMockFetch(
    async () => new Response(null, { status: 404 }),
    async () => {
      assert.equal(await getRepoMeta("missing-project"), null);
    }
  );
});

test("getRepoMeta throws for a non-retryable GitHub API failure", async () => {
  let requestCount = 0;

  await withMockFetch(
    async () => {
      requestCount += 1;
      return new Response(null, { status: 401 });
    },
    async () => {
      await assert.rejects(
        getRepoMeta("HA-Desktop-Widget"),
        /GitHub API request failed with status 401/
      );
      assert.equal(requestCount, 1);
    }
  );
});

test("getRepoMeta retries and then throws for a transient GitHub failure", async () => {
  let requestCount = 0;

  await withMockFetch(
    async () => {
      requestCount += 1;
      return new Response(null, { status: 503 });
    },
    async () => {
      await assert.rejects(
        getRepoMeta("HA-Desktop-Widget"),
        /GitHub API request failed with status 503/
      );
      assert.equal(requestCount, 3);
    }
  );
});

test("getRepoMeta still returns a public repository", async () => {
  await withMockFetch(
    async () =>
      Response.json({
        name: "HA-Desktop-Widget",
        private: false,
      }),
    async () => {
      const repo = await getRepoMeta("HA-Desktop-Widget");
      assert.equal(repo?.name, "HA-Desktop-Widget");
    }
  );
});
