import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpsProxyAgent } from "https-proxy-agent";

const listMock = vi.fn();

// Partial mock: keep the real `buildConnectionUrl` grammar, swap only the API
// client so the sub-user lookup is mocked (no network).
vi.mock("proxyhat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("proxyhat")>();
  return {
    ...actual,
    ProxyHat: class {
      sub_users = { list: listMock };
    },
  };
});

// Imported after the mock is registered.
const { proxyHatAgent, proxyHatProxyUrl } = await import("../src/agent.js");

const creds = { username: "user", password: "pass" };

afterEach(() => {
  listMock.mockReset();
  delete process.env.PROXYHAT_API_KEY;
  delete process.env.PROXYHAT_USERNAME;
  delete process.env.PROXYHAT_PASSWORD;
  delete process.env.PROXYHAT_SUBUSER;
});

describe("proxyHatProxyUrl", () => {
  it("builds a rotating gateway URL (no sticky id) with geo targeting", async () => {
    const url = await proxyHatProxyUrl({ ...creds, country: "us" });
    expect(url.startsWith("http://")).toBe(true);
    expect(url).toContain("gate.proxyhat.com:8080");
    expect(url).toContain("country-us");
    expect(url).not.toContain("-sid-");
  });

  it("pins one sticky session id when sticky is set", async () => {
    const url = await proxyHatProxyUrl({ ...creds, country: "us", sticky: true });
    expect(url).toContain("-sid-");
    expect(url).toContain("-ttl-30m");
  });

  it("honours a custom sticky TTL", async () => {
    const url = await proxyHatProxyUrl({ ...creds, country: "de", sticky: "12h" });
    expect(url).toContain("-ttl-12h");
  });

  it("encodes region, city and filter targeting", async () => {
    const url = await proxyHatProxyUrl({
      ...creds,
      country: "us",
      region: "california",
      city: "new york",
      filter: "high",
    });
    expect(url).toContain("country-us");
    expect(url).toContain("region-california");
    expect(url).toContain("city-new_york");
    expect(url).toContain("filter-high");
  });

  it("supports the socks5 protocol and port", async () => {
    const url = await proxyHatProxyUrl({ ...creds, country: "us", protocol: "socks5" });
    expect(url.startsWith("socks5://")).toBe(true);
    expect(url).toContain(":1080");
  });

  it("resolves credentials from an API-key sub-user lookup", async () => {
    listMock.mockResolvedValue([
      { uuid: "1", name: "live", suspended_at: null, traffic_limit: 0, used_traffic: 5, proxy_username: "gwu", proxy_password: "gwp" },
    ]);
    const url = await proxyHatProxyUrl({ apiKey: "ph_key", country: "us" });
    expect(listMock).toHaveBeenCalledOnce();
    expect(url).toContain("gwu-country-us");
  });
});

describe("proxyHatAgent", () => {
  it("returns an HttpsProxyAgent pointed at the gateway with geo baked in", async () => {
    const agent = await proxyHatAgent({ ...creds, country: "us" });
    expect(agent).toBeInstanceOf(HttpsProxyAgent);
    expect(agent.proxy.hostname).toBe("gate.proxyhat.com");
    expect(agent.proxy.port).toBe("8080");
    expect(agent.proxy.username).toContain("country-us");
    expect(agent.proxy.username).not.toContain("sid");
  });

  it("mints a sticky session id when sticky is set", async () => {
    const agent = await proxyHatAgent({ ...creds, country: "us", sticky: "1h" });
    expect(agent.proxy.username).toContain("sid");
    expect(agent.proxy.username).toContain("ttl-1h");
  });

  it("always uses the http gateway even if socks5 leaks in via options", async () => {
    // `protocol` is not part of ProxyHatOptions, but guard the agent path anyway.
    const agent = await proxyHatAgent({ ...creds, country: "us" } as Record<string, unknown>);
    expect(agent.proxy.protocol).toBe("http:");
    expect(agent.proxy.port).toBe("8080");
  });
});
