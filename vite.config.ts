// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [VitePWA({
      strategies: "generateSW",
      filename: "sw.js",
      outDir: "dist/client",
      manifest: false,
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      integration: { closeBundleOrder: "post" },
      workbox: {
        globDirectory: "dist/client",
        globPatterns: ["assets/**/*.{js,css,woff2}", "icons/*.png", "offline.{html,css,js}", "manifest.webmanifest"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Never retain an SSR document, including the sign-in page. The
            // impossible cache status disables all navigation writes while
            // NetworkFirst + precacheFallback provides a public offline page.
            urlPattern: ({ request, url }) => request.mode === "navigate" && !/^\/(?:~oauth|api|_server)(?:\/|$)/.test(url.pathname),
            handler: "NetworkFirst",
            options: { cacheName: "gie-navigation-no-private-data", cacheableResponse: { statuses: [] }, precacheFallback: { fallbackURL: "/offline.html" } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2)$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "gie-static-assets", cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 100, maxAgeSeconds: 2592000 } },
          },
        ],
      },
    })],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
