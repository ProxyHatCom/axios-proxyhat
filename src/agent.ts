import { HttpsProxyAgent } from "https-proxy-agent";
import { buildConnectionUrl, type ConnectionTargeting, type ProxyProtocol } from "proxyhat";
import { resolveCredentials, type CredentialOptions } from "./resolve.js";

/**
 * Options accepted by every helper here: credential fields (`apiKey` /
 * `username` / `password` / `subUser` / `baseUrl`) plus flat geo-targeting
 * fields (`country` / `region` / `city` / `filter` / `sticky`).
 *
 * **Sticky vs rotating** is decided by `sticky`:
 * - omit / `false` (default) → a stable rotating username, so the ProxyHat
 *   gateway hands out a fresh residential IP on every new connection;
 * - `true` (30m) or a TTL string (`"12h"`) → a single sticky session id is
 *   minted once and reused, pinning one IP for the whole agent/instance.
 */
export interface ProxyHatOptions extends CredentialOptions, ConnectionTargeting {}

/** Options for {@link proxyHatProxyUrl}: {@link ProxyHatOptions} plus a protocol. */
export interface ProxyHatProxyUrlOptions extends ProxyHatOptions {
  /** `http` (port 8080, default) or `socks5` (port 1080). */
  protocol?: ProxyProtocol;
}

/** Pull just the gateway targeting tokens out of a flat options object. */
function pickTargeting(options: ProxyHatOptions): ConnectionTargeting {
  const { country, region, city, sticky, filter } = options;
  return { country, region, city, sticky, filter };
}

/**
 * Resolve credentials and build a raw ProxyHat gateway proxy URL, e.g.
 * `http://<user>-country-us-sid-…:<pass>@gate.proxyhat.com:8080`.
 *
 * Useful for wiring the proxy by hand — into another agent, a `socks5` client
 * (pass `protocol: "socks5"`), or any library that takes a proxy URL string.
 */
export async function proxyHatProxyUrl(options: ProxyHatProxyUrlOptions = {}): Promise<string> {
  const credentials = await resolveCredentials(options);
  return buildConnectionUrl({
    username: credentials.username,
    password: credentials.password,
    protocol: options.protocol,
    ...pickTargeting(options),
  });
}

/**
 * Build an {@link HttpsProxyAgent} pointed at the ProxyHat HTTP gateway
 * (`gate.proxyhat.com:8080`). It tunnels **HTTPS** requests via HTTP `CONNECT`,
 * which is why axios's own `proxy` option (unreliable for HTTPS) should be left
 * off — see {@link createProxyHatAxios}.
 *
 * The agent carries the targeting-encoded gateway username, so a single agent
 * pins one sticky IP (when `sticky` is set) or rotates a fresh IP per connection
 * (default). Geo targeting (`country` / `region` / `city` / `filter`) is baked
 * into the username here.
 */
export async function proxyHatAgent(options: ProxyHatOptions = {}): Promise<HttpsProxyAgent<string>> {
  // Agents always go through the HTTP gateway; `https-proxy-agent` is an
  // HTTP-proxy agent. For socks5 use `proxyHatProxyUrl({ protocol: "socks5" })`
  // with a socks agent of your choice.
  const url = await proxyHatProxyUrl({ ...options, protocol: "http" });
  return new HttpsProxyAgent(url);
}

/**
 * Same as {@link proxyHatAgent}. `https-proxy-agent` tunnels both `http:` and
 * `https:` targets through the gateway via `CONNECT`, so one agent can serve as
 * both axios `httpsAgent` and `httpAgent`. Exposed under this name for callers
 * wiring plain-HTTP requests explicitly.
 *
 * Note: each call mints its own gateway username, so a `sticky` agent from this
 * function pins a *different* IP than one from {@link proxyHatAgent}. To share
 * one sticky IP across http and https, reuse a single agent (as
 * {@link createProxyHatAxios} does).
 */
export async function proxyHatHttpAgent(options: ProxyHatOptions = {}): Promise<HttpsProxyAgent<string>> {
  return proxyHatAgent(options);
}
