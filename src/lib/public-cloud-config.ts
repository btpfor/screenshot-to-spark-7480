type PublicConfig = { url?: string | undefined; key?: string | undefined };

// Select a complete pair: mixing server and browser deployments can target the wrong backend.
export function publicCloudConfig(server: PublicConfig, browser: PublicConfig) {
  if (server.url && server.key) return { url: server.url, key: server.key };
  if (browser.url && browser.key) return { url: browser.url, key: browser.key };
  return null;
}