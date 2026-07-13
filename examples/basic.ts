/**
 * Minimal axios + ProxyHat example.
 *
 *   PROXYHAT_API_KEY=ph_xxx npx tsx examples/basic.ts
 *
 * Every request exits from a US residential IP. With `sticky` off (default) the
 * gateway rotates a fresh IP per connection; pass `sticky: true` to pin one.
 */
import { createProxyHatAxios } from "axios-proxyhat";

const client = await createProxyHatAxios({
  apiKey: process.env.PROXYHAT_API_KEY,
  country: "us",
});

const { data } = await client.get("https://httpbin.org/ip");
console.log("Exit IP:", data);
