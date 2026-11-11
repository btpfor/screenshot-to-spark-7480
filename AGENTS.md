<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Staff password replacement uses the shared password-change page; initial accounts carry a user-metadata reminder, never a role claim, so credentials remain solely in Auth and roles in user_roles.
- Member identifier derivation and validation live in member-ids.ts and run server-side for both individual creation and imports; store the resulting identifier in matricule to preserve existing card and login paths, and reject collisions via its unique constraint.
- Member creation and imports share CNI-first duplicate checks in member-duplicates.ts and database uniqueness safeguards, so conflicts are rejected before Auth creation and concurrent requests cannot create duplicate CNIs.
- PWA installation is shared through InstallAppProvider; only pwa.ts registers the generated app-shell worker, refusing dev, iframe and preview hosts. Cache static public assets only; NetworkFirst navigations never write responses and fall back to a public offline document, so authenticated SSR and API data remain uncached.
- Future push notifications must use opt-in Web Push subscriptions with VAPID and authenticated server authorization; capability detection alone must never request permission or send notifications.
- President content uses a singleton with publication-filtered public reads and separate editor reads; database and media policies restrict edits to institutional editors so drafts remain editable but invisible publicly. New media stays private and receives signed URLs only when published or accessed by an editor.
- Public Cloud reads select a complete runtime configuration pair, falling back only to bundled publishable configuration for external deployments; never use privileged keys for public reads.
- Router dehydration restores the request-local Query cache before browser rendering to preserve SSR data and signed media URLs.
- Responsive member/user cards reuse desktop data and action handlers; dialogs use dynamic viewport bounds, and membership-card exports retain fixed ID-1 geometry.
- Mobile admin navigation uses a Radix Sheet and public navigation a disclosure; shared dialogs restore their opener without stealing focus from another dialog, preserving keyboard access and existing visuals.
- Shared branding and membership cards use the public asset URL from branding.ts when settings have no override or fail to load; keep the official logo in public/images so external deployments do not depend on Lovable's asset proxy. Installed-app icons derive from the same source.
- Mission counter definitions and interpolation live in mission-stats.ts; animate once on visibility while keeping final values accessible and respecting reduced motion.
- Bureau media shares the private president-media bucket; public signing is restricted to the current group photo or published bureau entries, editors can read drafts, and contact buttons follow each entry's authorization. New entries start unpublished to avoid exposing incomplete details.
- External (Cloudflare) deployments reach admin operations only through the /api/public/membres* bridge hosted on Lovable: callers authenticate with their own login token plus a server-side role check, CORS is restricted to the allowlist in api-auth.ts, and the service-role key never leaves Lovable hosting. The frontend picks the bridge when VITE_API_URL is set, otherwise same-origin server functions.
