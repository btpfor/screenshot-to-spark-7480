import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { apiError, authenticateApiRequest, json, optionsResponse, requireRoles } from "@/lib/api-auth";
import { MANAGERS, resetPasswordFor, setStatusFor } from "@/lib/members.functions";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset_password"), driverId: z.string().uuid() }),
  z.object({
    action: z.literal("set_status"),
    driverId: z.string().uuid(),
    status: z.enum(["actif", "inactif", "suspendu"]),
    account: z.enum(["actif", "desactive", "bloque"]),
  }),
]);

// Account actions bridge for the external (Cloudflare) deployment: password
// reset, suspend, reactivate, block. Every action is role-checked and audited.
export const Route = createFileRoute("/api/public/membres/compte")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => optionsResponse(request),
      POST: async ({ request }) => {
        try {
          const ctx = await authenticateApiRequest(request);
          await requireRoles(ctx, MANAGERS);
          const body = actionSchema.parse(await request.json());
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          if (body.action === "reset_password") {
            return json(request, await resetPasswordFor(supabaseAdmin, body.driverId, ctx.userId));
          }
          return json(request, await setStatusFor(supabaseAdmin, body.driverId, body.status, body.account, ctx.userId));
        } catch (e) {
          return apiError(request, e);
        }
      },
    },
  },
});
