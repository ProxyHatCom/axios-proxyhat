# axios-proxyhat

Route [axios](https://axios-http.com) requests through [ProxyHat](https://proxyhat.com?utm_source=github&utm_medium=readme&utm_campaign=axios) residential proxies — a preconfigured axios instance (or a ready-made `https-proxy-agent`) with rotating IPs, geo-targeting, and sticky sessions.

[![CI](https://github.com/ProxyHatCom/axios-proxyhat/actions/workflows/ci.yml/badge.svg)](https://github.com/ProxyHatCom/axios-proxyhat/actions/workflows/ci.yml)
[![Compatible with axios latest](https://github.com/ProxyHatCom/axios-proxyhat/actions/workflows/compat.yml/badge.svg)](https://github.com/ProxyHatCom/axios-proxyhat/actions/workflows/compat.yml)
[![npm](https://img.shields.io/npm/v/axios-proxyhat)](https://www.npmjs.com/package/axios-proxyhat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why

Scraping and API automation from datacenter IPs gets you blocked and rate-limited. This package plugs ProxyHat's residential IPs (50M+ across 148+ countries) into axios the right way: a proxy **agent** (via [`https-proxy-agent`](https://www.npmjs.com/package/https-proxy-agent)) with `proxy: false`. axios's built-in `proxy` option is [unreliable for HTTPS](https://github.com/axios/axios/issues/925) because it doesn't tunnel with `CONNECT`; an `HttpsProxyAgent` does, so HTTPS traffic is proxied end-to-end with the target's own TLS.

## Install

```bash
npm install axios-proxyhat
```

`axios` is a peer dependency — bring your own version (`>=1`).

## Quick start

```ts
import { createProxyHatAxios } from "axios-proxyhat";

// An API key auto-selects an active residential sub-user:
const client = await createProxyHatAxios({
  apiKey: process.env.PROXYHAT_API_KEY,
  country: "us",
});

const { data } = await client.get("https://httpbin.org/ip");
console.log(data); // → a US residential exit IP
```

`createProxyHatAxios` returns a standard axios instance preconfigured with
`{ httpsAgent, httpAgent, proxy: false }` — use it exactly like `axios`.

Get an API key at [proxyhat.com](https://proxyhat.com?utm_source=github&utm_medium=readme&utm_campaign=axios).

## Credentials

Pass them explicitly or via environment variables — options win over env:

| Option | Env var | Notes |
|---|---|---|
| `apiKey` | `PROXYHAT_API_KEY` | Auto-selects an active sub-user with remaining traffic |
| `subUser` | `PROXYHAT_SUBUSER` | Pick a specific sub-user by uuid or name (with an API key) |
| `username` | `PROXYHAT_USERNAME` | Explicit gateway `proxy_username` (skips the API) |
| `password` | `PROXYHAT_PASSWORD` | Explicit gateway `proxy_password` |

## Targeting

Targeting fields are flat on the options object:

```ts
const client = await createProxyHatAxios({
  apiKey: process.env.PROXYHAT_API_KEY,
  country: "us",        // ISO code or "any" (default)
  region: "california",
  city: "new_york",
  filter: "high",       // AI IP-quality tier
});
```

### Rotating vs sticky

The `sticky` option decides how IPs behave for the whole instance:

- **Rotating (default)** — omit `sticky` (or `sticky: false`). A stable username
  means the gateway hands out a **fresh residential IP on every new connection**.
- **Sticky** — `sticky: true` (30m) or a TTL string like `sticky: "12h"`. One
  session id is minted once and reused, **pinning a single IP** for the lifetime
  of the instance.

```ts
// Same IP for every request from this client, for up to 12 hours:
const client = await createProxyHatAxios({ apiKey, country: "us", sticky: "12h" });
```

### Extra axios options

Pass any axios defaults (base URL, headers, timeout, …) as the second argument;
the proxy fields are applied on top:

```ts
const client = await createProxyHatAxios(
  { apiKey: process.env.PROXYHAT_API_KEY, country: "gb" },
  { baseURL: "https://api.example.com", timeout: 10_000 },
);
```

## Advanced: bring your own axios config

Need to wire the agent into an existing axios instance, or set it per-request?
Build the agent yourself:

```ts
import axios from "axios";
import { proxyHatAgent } from "axios-proxyhat";

const agent = await proxyHatAgent({ apiKey: process.env.PROXYHAT_API_KEY, country: "us" });

// Reuse one agent for both schemes so a sticky IP stays consistent:
const client = axios.create({ httpsAgent: agent, httpAgent: agent, proxy: false });

// …or per request:
await axios.get("https://httpbin.org/ip", { httpsAgent: agent, proxy: false });
```

> Always set `proxy: false` when you pass an agent — otherwise axios may try to
> apply its own proxy handling on top and break HTTPS tunneling.

`proxyHatHttpAgent` is available for wiring plain-HTTP requests explicitly; it
returns the same kind of `CONNECT`-tunneling agent.

## Raw proxy URL

Need the gateway URL for something else (a `socks5` client, another HTTP library,
env vars)? Build it directly:

```ts
import { proxyHatProxyUrl } from "axios-proxyhat";

const url = await proxyHatProxyUrl({ apiKey: process.env.PROXYHAT_API_KEY, country: "us" });
// → http://<user>-country-us:<pass>@gate.proxyhat.com:8080

// SOCKS5 is on port 1080 — pair it with a socks agent of your choice:
const socksUrl = await proxyHatProxyUrl({ apiKey, country: "us", protocol: "socks5" });
```

The core agents use the HTTP gateway (`gate.proxyhat.com:8080`), which
`https-proxy-agent` tunnels both HTTP and HTTPS through via `CONNECT`. For SOCKS5,
take `proxyHatProxyUrl({ protocol: "socks5" })` and pair it with a socks agent
(e.g. [`socks-proxy-agent`](https://www.npmjs.com/package/socks-proxy-agent)) —
kept out of core to avoid an extra dependency.

## How it works

`createProxyHatAxios` resolves your gateway credentials once (via the official
[`proxyhat`](https://www.npmjs.com/package/proxyhat) SDK), builds a single
`HttpsProxyAgent` whose username encodes your geo + sticky targeting, and returns
an axios instance using that agent for both `httpAgent` and `httpsAgent` with
`proxy: false`. Because the username is fixed per instance, a sticky session pins
one IP while a rotating one lets the gateway hand out a fresh IP per connection.

## License

MIT © [ProxyHat](https://proxyhat.com)
