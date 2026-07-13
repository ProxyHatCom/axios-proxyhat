import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";
import { proxyHatAgent, type ProxyHatOptions } from "./agent.js";

export {
  proxyHatAgent,
  proxyHatHttpAgent,
  proxyHatProxyUrl,
} from "./agent.js";
export type { ProxyHatOptions, ProxyHatProxyUrlOptions } from "./agent.js";
export type { ConnectionTargeting, ProxyProtocol, ProxyFilter } from "proxyhat";
export { resolveCredentials } from "./resolve.js";
export type { CredentialOptions, ResolvedCredentials } from "./resolve.js";

/**
 * Create an [axios](https://axios-http.com) instance whose every request is
 * routed through ProxyHat residential proxies.
 *
 * The instance is preconfigured with `{ httpsAgent, httpAgent, proxy: false }`:
 * a single {@link HttpsProxyAgent} tunnels both HTTP and HTTPS through the
 * gateway via `CONNECT`, and `proxy: false` disables axios's own (HTTPS-unsafe)
 * proxy handling so the agent is always used.
 *
 * ```ts
 * import { createProxyHatAxios } from "axios-proxyhat";
 *
 * // An API key auto-selects an active residential sub-user:
 * const client = await createProxyHatAxios({
 *   apiKey: process.env.PROXYHAT_API_KEY,
 *   country: "us",
 * });
 *
 * const { data } = await client.get("https://httpbin.org/ip");
 * ```
 *
 * **Sticky** (`sticky: true` or a TTL like `"12h"`) pins one residential IP for
 * the lifetime of this instance. **Rotating** (the default) uses a stable
 * username so the gateway hands out a fresh IP per connection.
 *
 * Any extra axios defaults (base URL, headers, timeout, …) can be passed as the
 * second argument; the proxy fields are applied on top.
 */
export async function createProxyHatAxios(
  options: ProxyHatOptions = {},
  axiosConfig: CreateAxiosDefaults = {},
): Promise<AxiosInstance> {
  // One agent for both http and https keeps a sticky session pinned to the same
  // IP regardless of target scheme (and shares connection keep-alive).
  const agent = await proxyHatAgent(options);
  return axios.create({
    ...axiosConfig,
    httpsAgent: agent,
    httpAgent: agent,
    proxy: false,
  });
}
