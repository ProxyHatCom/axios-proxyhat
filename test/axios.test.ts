import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpsProxyAgent } from "https-proxy-agent";

const listMock = vi.fn();

vi.mock("proxyhat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("proxyhat")>();
  return {
    ...actual,
    ProxyHat: class {
      sub_users = { list: listMock };
    },
  };
});

const { createProxyHatAxios } = await import("../src/index.js");

const creds = { username: "user", password: "pass" };

afterEach(() => {
  listMock.mockReset();
});

describe("createProxyHatAxios", () => {
  it("preconfigures the instance with a proxy agent and proxy: false", async () => {
    const client = await createProxyHatAxios({ ...creds, country: "us" });
    const { httpsAgent, httpAgent, proxy } = client.defaults;

    expect(proxy).toBe(false); // axios's own (HTTPS-unsafe) proxy handling is off
    expect(httpsAgent).toBeInstanceOf(HttpsProxyAgent);
    // Same single agent for http and https so a sticky IP stays consistent.
    expect(httpAgent).toBe(httpsAgent);
    expect((httpsAgent as HttpsProxyAgent<string>).proxy.hostname).toBe("gate.proxyhat.com");
    expect((httpsAgent as HttpsProxyAgent<string>).proxy.username).toContain("country-us");
  });

  it("maps sticky to a single pinned session id on the instance agent", async () => {
    const client = await createProxyHatAxios({ ...creds, sticky: true });
    const agent = client.defaults.httpsAgent as HttpsProxyAgent<string>;
    expect(agent.proxy.username).toContain("sid");
    expect(agent.proxy.username).toContain("ttl-30m");
  });

  it("leaves rotating (default) usernames without a session id", async () => {
    const client = await createProxyHatAxios({ ...creds, country: "de" });
    const agent = client.defaults.httpsAgent as HttpsProxyAgent<string>;
    expect(agent.proxy.username).toContain("country-de");
    expect(agent.proxy.username).not.toContain("sid");
  });

  it("passes extra axios defaults through", async () => {
    const client = await createProxyHatAxios(
      { ...creds },
      { baseURL: "https://api.example.com", timeout: 1234 },
    );
    expect(client.defaults.baseURL).toBe("https://api.example.com");
    expect(client.defaults.timeout).toBe(1234);
    expect(client.defaults.proxy).toBe(false);
  });

  it("resolves credentials via the API key when given", async () => {
    listMock.mockResolvedValue([
      { uuid: "1", name: "live", suspended_at: null, traffic_limit: 0, used_traffic: 5, proxy_username: "gwu", proxy_password: "gwp" },
    ]);
    const client = await createProxyHatAxios({ apiKey: "ph_key", country: "us" });
    const agent = client.defaults.httpsAgent as HttpsProxyAgent<string>;
    expect(listMock).toHaveBeenCalledOnce();
    expect(agent.proxy.username).toContain("gwu-country-us");
  });
});
