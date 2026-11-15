import { createFileRoute } from "@tanstack/react-router";
import { apiError,authenticateApiRequest,json,optionsResponse } from "@/lib/api-auth";
import { membershipActionSchema,runMembership } from "@/lib/membership.functions";
export const Route=createFileRoute("/api/public/membres/dossier")({server:{handlers:{OPTIONS:async({request})=>optionsResponse(request),POST:async({request})=>{try {const ctx=await authenticateApiRequest(request);return json(request,await runMembership(ctx,membershipActionSchema.parse(await request.json())));}catch(e){return apiError(request,e);}}}}});