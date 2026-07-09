import { describe, expect, it } from "bun:test";

import worker, { type Env } from "../worker";

const assetsResponse = new Response("asset-body");
const env: Env = {
  ASSETS: { fetch: () => Promise.resolve(assetsResponse) },
};

const fetchWorker = (url: string): Promise<Response> => worker.fetch(new Request(url), env);

describe("site worker", () => {
  it("redirects css-in-js.dev to dx-styles.dev preserving path and query", async () => {
    const response = await fetchWorker("https://css-in-js.dev/docs/start?utm=1");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://dx-styles.dev/docs/start?utm=1");
  });

  it("redirects www.css-in-js.dev to the canonical host", async () => {
    const response = await fetchWorker("https://www.css-in-js.dev/");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://dx-styles.dev/");
  });

  it("redirects www.dx-styles.dev to the apex host", async () => {
    const response = await fetchWorker("https://www.dx-styles.dev/pricing");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://dx-styles.dev/pricing");
  });

  it("upgrades redirect targets to https", async () => {
    const response = await fetchWorker("http://css-in-js.dev/");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://dx-styles.dev/");
  });

  it("serves assets for the canonical host untouched", async () => {
    const response = await fetchWorker("https://dx-styles.dev/");
    expect(response).toBe(assetsResponse);
  });

  it("serves assets for local development hosts", async () => {
    const response = await fetchWorker("http://localhost:8787/");
    expect(response).toBe(assetsResponse);
  });
});
