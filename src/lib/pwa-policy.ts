// Only the app-shell worker is managed here; messaging workers are unrelated.
export function refuseAppWorker(prod: boolean, hostname: string, framed: boolean, search: string) {
  const host = hostname.toLowerCase();
  const labels = host.split(".");
  const lovableDomain = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  return !prod || framed || new URLSearchParams(search).get("sw") === "off"
    || (lovableDomain && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(labels[0] ?? ""))
    || (lovableDomain && /^project--.+-dev$/.test(labels[0] ?? ""))
    || /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(host);
}

export function appWorkerScript(scriptURL: string, origin: string) {
  const url = new URL(scriptURL);
  return url.origin === origin && url.pathname === "/sw.js";
}

export function installationPlatform(ua: string, touchPoints: number) {
  if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

// Future notification opt-in must use PushManager + VAPID and a verified server subscription.
// This only reports capability: it never requests permission or creates a subscription.
export function supportsMemberPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator
    && "PushManager" in window && "Notification" in window;
}