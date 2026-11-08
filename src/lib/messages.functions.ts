import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-6-astra";

export const analyzeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Accès refusé");
    const { data: msg, error } = await context.supabase.from("contact_messages").select("*").eq("id", data.messageId).single();
    if (error || !msg) throw new Error("Message introuvable");
    const { data: settings } = await context.supabase.from("gie_settings").select("official_name").eq("id", 1).single();

    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: MODEL,
        instructions:
          `Tu assistes les responsables du ${settings?.official_name ?? "GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL"}, un groupement de chauffeurs au Sénégal. ` +
          "Pour chaque message reçu, rédige en français : un résumé factuel en 1 à 3 phrases, une catégorie, et un brouillon de réponse courtois, " +
          "professionnel et bref, signé « L'administration du GIE ». N'invente aucun fait, montant, date ou engagement : si une information manque, propose de recontacter la personne.",
        input: [{ role: "user", content: `Expéditeur : ${msg.name}${msg.phone ? ` (tél. ${msg.phone})` : ""}\n\nMessage :\n${msg.message}` }],
        text: {
          format: {
            type: "json_schema",
            name: "analyse_message",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["summary", "category", "draft"],
              properties: {
                summary: { type: "string" },
                category: { type: "string", enum: ["Adhésion", "Cotisation", "Financement", "Réclamation", "Partenariat", "Information", "Autre"] },
                draft: { type: "string" },
              },
            },
          },
        },
      });
      const text = res.output
        .flatMap((o) => (o.type === "message" ? o.content : []))
        .map((c) => (c.type === "output_text" ? c.text : ""))
        .join("");
      const parsed = z.object({ summary: z.string(), category: z.string(), draft: z.string() }).parse(JSON.parse(text));
      await context.supabase.from("contact_messages").update({
        ai_summary: parsed.summary, ai_category: parsed.category, ai_draft: parsed.draft, ai_generated_at: new Date().toISOString(),
      }).eq("id", msg.id);
      return parsed;
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("AI gateway error", e.code, e.ids);
        if (e.httpStatus === 402) throw new Error("Crédits IA épuisés. Rechargez les crédits de l'espace de travail.");
        if (e.httpStatus === 429) throw new Error("Trop de demandes, réessayez dans un instant.");
        throw new Error("L'analyse IA a échoué, réessayez plus tard.");
      }
      throw e;
    }
  });
