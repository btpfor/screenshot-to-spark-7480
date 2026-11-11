import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, authenticateApiRequest, json, optionsResponse, requireRoles } from "@/lib/api-auth";
import { importMemberRows, MANAGERS, memberSchema } from "@/lib/members.functions";

// CSV import bridge for the external (Cloudflare) deployment.
export const Route = createFileRoute("/api/public/membres/import")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      POST: async ({ request }) => {
        try {
          const ctx = await authenticateApiRequest(request);
          await requireRoles(ctx, MANAGERS);
          const { rows } = z.object({ rows: z.array(memberSchema).max(1000) }).parse(await request.json());
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const results = await importMemberRows(supabaseAdmin, rows);
          return json(request, results);
        } catch (e) {
          return apiError(request, e);
        }
      },
    },
  },
});
