import { afterEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();

vi.mock("proxyhat", () => ({
  ProxyHat: class {
    sub_users = { list: listMock };
  },
}));

// Imported after the mock is registered.
const { resolveCredentials } = await import("../src/resolve.js");

afterEach(() => {
  listMock.mockReset();
  delete process.env.PROXYHAT_API_KEY;
  delete process.env.PROXYHAT_USERNAME;
  delete process.env.PROXYHAT_PASSWORD;
  delete process.env.PROXYHAT_SUBUSER;
});

describe("resolveCredentials", () => {
  it("uses explicit username/password without touching the API", async () => {
    const creds = await resolveCredentials({ username: "u", password: "p" });
    expect(creds).toEqual({ username: "u", password: "p" });
    expect(listMock).not.toHaveBeenCalled();
  });

  it("reads gateway credentials from the environment", async () => {
    process.env.PROXYHAT_USERNAME = "envu";
    process.env.PROXYHAT_PASSWORD = "envp";
    expect(await resolveCredentials()).toEqual({ username: "envu", password: "envp" });
  });

  it("auto-picks the first active sub-user from an API key", async () => {
    listMock.mockResolvedValue([
      { uuid: "1", name: "dead", suspended_at: "2026-01-01", traffic_limit: 0, used_traffic: 0, proxy_username: "x", proxy_password: "y" },
      { uuid: "2", name: "live", suspended_at: null, traffic_limit: 0, used_traffic: 5, proxy_username: "gwu", proxy_password: "gwp" },
    ]);
    expect(await resolveCredentials({ apiKey: "ph_key" })).toEqual({ username: "gwu", password: "gwp" });
  });

  it("skips sub-users that are out of traffic", async () => {
    listMock.mockResolvedValue([
      { uuid: "1", name: "full", suspended_at: null, traffic_limit: 100, used_traffic: 100, proxy_username: "x", proxy_password: "y" },
      { uuid: "2", name: "ok", suspended_at: null, traffic_limit: 100, used_traffic: 10, proxy_username: "gwu", proxy_password: "gwp" },
    ]);
    expect(await resolveCredentials({ apiKey: "ph_key" })).toEqual({ username: "gwu", password: "gwp" });
  });

  it("picks a named sub-user when subUser is given", async () => {
    listMock.mockResolvedValue([
      { uuid: "1", name: "us-pool", suspended_at: null, traffic_limit: 0, used_traffic: 0, proxy_username: "usu", proxy_password: "usp" },
      { uuid: "2", name: "eu-pool", suspended_at: null, traffic_limit: 0, used_traffic: 0, proxy_username: "euu", proxy_password: "eup" },
    ]);
    expect(await resolveCredentials({ apiKey: "ph_key", subUser: "eu-pool" })).toEqual({ username: "euu", password: "eup" });
  });

  it("throws a helpful error when nothing is configured", async () => {
    await expect(resolveCredentials()).rejects.toThrow(/no credentials/);
  });

  it("throws when no sub-user is usable", async () => {
    listMock.mockResolvedValue([
      { uuid: "1", name: "dead", suspended_at: "2026-01-01", traffic_limit: 0, used_traffic: 0, proxy_username: "x", proxy_password: "y" },
    ]);
    await expect(resolveCredentials({ apiKey: "ph_key" })).rejects.toThrow(/no usable sub-user/);
  });
});
