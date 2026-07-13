import { ProxyHat } from "proxyhat";

export interface ResolvedCredentials {
  /** Sub-user gateway login (`proxy_username`). */
  username: string;
  /** Sub-user gateway password (`proxy_password`). */
  password: string;
}

export interface CredentialOptions {
  /** ProxyHat API key — auto-selects an active residential sub-user. Defaults to `PROXYHAT_API_KEY`. */
  apiKey?: string;
  /** Explicit gateway login (`proxy_username`). Defaults to `PROXYHAT_USERNAME`. */
  username?: string;
  /** Explicit gateway password (`proxy_password`). Defaults to `PROXYHAT_PASSWORD`. */
  password?: string;
  /** Pick a specific sub-user by uuid or name (with an API key). Defaults to `PROXYHAT_SUBUSER`. */
  subUser?: string;
  /** Override the management API base URL. */
  baseUrl?: string;
}

function env(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value?.trim() || undefined;
}

/**
 * Resolve gateway credentials from explicit options or the environment.
 *
 * Precedence: explicit `username`/`password` (or `PROXYHAT_USERNAME`/`PASSWORD`)
 * win; otherwise an API key (`PROXYHAT_API_KEY`) looks up your sub-users and
 * picks an active one with remaining traffic — or the one named by `subUser`.
 */
export async function resolveCredentials(options: CredentialOptions = {}): Promise<ResolvedCredentials> {
  const username = options.username ?? env("PROXYHAT_USERNAME");
  const password = options.password ?? env("PROXYHAT_PASSWORD");
  if (username && password) return { username, password };

  const apiKey = options.apiKey ?? env("PROXYHAT_API_KEY");
  if (!apiKey) {
    throw new Error(
      "axios-proxyhat: no credentials. Pass { apiKey } (or PROXYHAT_API_KEY), " +
        "or { username, password } (PROXYHAT_USERNAME / PROXYHAT_PASSWORD).",
    );
  }

  const client = new ProxyHat({ apiKey, baseUrl: options.baseUrl });
  const list = await client.sub_users.list();
  const want = (options.subUser ?? env("PROXYHAT_SUBUSER"))?.trim();
  const usable = list.filter(
    (s) => !s.suspended_at && (s.traffic_limit === 0 || s.used_traffic < s.traffic_limit),
  );
  const chosen = want ? list.find((s) => s.uuid === want || s.name === want) : usable[0];

  if (!chosen?.proxy_username || !chosen?.proxy_password) {
    throw new Error(
      want
        ? `axios-proxyhat: no sub-user matched "${want}" (or it has no proxy credentials).`
        : "axios-proxyhat: no usable sub-user found (all suspended or out of traffic). " +
          "Create one, top up, or pass { subUser }.",
    );
  }
  return { username: chosen.proxy_username, password: chosen.proxy_password };
}
