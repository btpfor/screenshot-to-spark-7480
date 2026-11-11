import { createFileRoute } from "@tanstack/react-router";
import { apiError, authenticateApiRequest, json, optionsResponse, requireRoles } from "@/lib/api-auth";
import { createOne, MANAGERS, memberSchema } from "@/lib/members.functions";

// Admin bridge for the external (Cloudflare) deployment: creates a member and
// their login account. The service-role key never leaves Lovable hosting; the
// caller is verified with their own login token plus a role check.
export const Route = createFileRoute("/api/public/membres")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      POST: async ({ request }) => {
        try {
          const ctx = await authenticateApiRequest(request);
          await requireRoles(ctx, MANAGERS);
          const body = memberSchema.parse(await request.json());
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await createOne(supabaseAdmin, body);
          return json(request, result);
        } catch (e) {
          return apiError(request, e);
        }
      },
    },
  },
});
