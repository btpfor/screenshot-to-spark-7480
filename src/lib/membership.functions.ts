import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ApiAuthContext } from "./api-auth";
import { profileSchema, editableDossier, missingProfile } from "./membership-rules";
import { admin, assertManager } from "./members.functions";

export const membershipActionSchema = z.object({action:z.enum(["load","save","review","issue","card_status","settings","read"]),driverId:z.string().uuid().optional(),profile:profileSchema.optional(),submit:z.boolean().optional(),status:z.string().max(30).optional(),message:z.string().max(2000).optional(),comment:z.string().max(3000).optional(),adhesionDate:z.string().optional(),start:z.string().optional(),end:z.string().optional(),reason:z.enum(["initial","renewal","loss"]).optional(),cardId:z.string().uuid().optional(),notificationId:z.string().uuid().optional(),settings:z.object({validity_months:z.number().int().min(1).max(120).nullable(),terms:z.string().max(3000),loss_instructions:z.string().max(3000),signature_path:z.string().nullable(),stamp_path:z.string().nullable(),photo_width_mm:z.number().int().min(10).max(100),photo_height_mm:z.number().int().min(10).max(100)}).optional()});
type Action=z.infer<typeof membershipActionSchema>;
export async function runMembership(ctx:ApiAuthContext,input:Action) {
 const { data: manager }=await ctx.supabase.rpc("membership_manager");
 const a=await admin();
 if(input.action==="read") {
  if(!input.notificationId) throw new Error("Notification manquante");
  const {error}=await ctx.supabase.from("member_notifications").update({read_at:new Date().toISOString()}).eq("id",input.notificationId).eq("recipient_id",ctx.userId);
  if(error) throw new Error("Notification indisponible"); return {ok:true};
 }
 if(input.action==="settings") {
  await assertManager(ctx); if(!input.settings) throw new Error("Paramètres manquants");
  for(const path of [input.settings.signature_path,input.settings.stamp_path]) if(path && !path.startsWith("institution/")) throw new Error("Fichier institutionnel invalide");
  const {error}=await a.from("membership_settings").upsert({id:1,...input.settings}); if(error) throw new Error("Enregistrement impossible"); return {ok:true};
 }
 const driverQuery=a.from("drivers").select("*");
 const {data:driver,error:de}=input.driverId?await driverQuery.eq("id",input.driverId).maybeSingle():await driverQuery.eq("user_id",ctx.userId).maybeSingle();
 if(de) throw new Error("Lecture du membre impossible");
 if(driver && !manager && driver.user_id!==ctx.userId) throw new Error("Accès refusé");
 if(!driver) {
  if(input.action!=="load") throw new Error("Dossier introuvable");
  const {data:notifications}=await ctx.supabase.from("member_notifications").select("*").order("created_at",{ascending:false}).limit(50);
  return {driver:null,dossier:null,documents:[],cards:[],notifications:notifications??[],settings:null,manager:!!manager};
 }
 const {data:dossier}=await a.from("member_dossiers").select("*").eq("driver_id",driver.id).single();
 if(!dossier) throw new Error("Dossier introuvable");
 if(input.action==="save") {
  if(driver.user_id!==ctx.userId && !manager) throw new Error("Accès refusé");
  if(!editableDossier(dossier.status)) throw new Error("Ce dossier est verrouillé. Une correction doit être demandée avant modification.");
  if(!input.profile) throw new Error("Profil manquant");
  for(const path of [input.profile.original_photo_path,input.profile.confirmed_photo_path]) if(path && path!==dossier.original_photo_path && path!==dossier.confirmed_photo_path && !path.startsWith(driver.id+"/")) throw new Error("Photo invalide");
  if(input.submit && missingProfile(input.profile).length) throw new Error("Informations manquantes : "+missingProfile(input.profile).join(", "));
  const {error}=await a.from("member_dossiers").update({...input.profile,status:input.submit?"soumis":dossier.status,submitted_at:input.submit?new Date().toISOString():dossier.submitted_at}).eq("driver_id",driver.id).eq("status",dossier.status);
  if(error) throw new Error(error.code==="23505"?"Cette pièce d’identité est déjà enregistrée.":error.message);
  return {ok:true};
 }
 if(["review","issue","card_status"].includes(input.action)) await assertManager(ctx);
 if(input.action==="review") {
  if(!["verification","correction","valide","rejete"].includes(input.status??"")) throw new Error("Décision invalide");
  if(["correction","rejete"].includes(input.status??"")&&!input.message?.trim()) throw new Error("Précisez le motif destiné au membre.");
  if(input.status==="valide" && (missingProfile({...dossier,certified:true}).length || !input.adhesionDate)) throw new Error("Complétez le dossier et choisissez une date d’adhésion.");
  if(input.status==="valide" && !["soumis","verification"].includes(dossier.status)) throw new Error("Le dossier doit être soumis avant validation.");
  const {error}=await a.rpc("review_membership_dossier",{_driver:driver.id,_status:input.status??"",_message:input.message??"",_comment:input.comment??"",_adhesion:input.adhesionDate||dossier.adhesion_date||driver.join_date,_actor:ctx.userId});
  if(error) throw new Error(error.message); return {ok:true};
 }
 if(input.action==="issue") {
  if(!input.start||!input.end||!/^\d{4}-\d{2}-\d{2}$/.test(input.start)||!/^\d{4}-\d{2}-\d{2}$/.test(input.end)||input.end<input.start) throw new Error("Choisissez des dates de validité cohérentes.");
  const {data,error}=await a.rpc("issue_membership_card",{_driver:driver.id,_start:input.start,_end:input.end,_reason:input.reason??"initial",_actor:ctx.userId});
  if(error) throw new Error(error.message); return {ok:true,cardId:data};
 }
 if(input.action==="card_status") {
  if(!input.cardId||!["active","suspended","cancelled"].includes(input.status??"")) throw new Error("Carte ou statut invalide");
  const {error}=await a.rpc("membership_card_status",{_card:input.cardId,_driver:driver.id,_status:input.status??"cancelled",_actor:ctx.userId});
  if(error) throw new Error(error.message);
  return {ok:true};
 }
 const [docs,cards,notes,settings]=await Promise.all([a.from("member_documents").select("*").eq("driver_id",driver.id),a.from("membership_cards").select("*").eq("driver_id",driver.id).order("issued_at",{ascending:false}),ctx.supabase.from("member_notifications").select("*").order("created_at",{ascending:false}).limit(50),a.from("membership_settings").select("*").eq("id",1).maybeSingle()]);
 const signed=async(bucket:string,path:string|null)=> {if(!path)return null;const {data}=await a.storage.from(bucket).createSignedUrl(path,300);const url=data?.signedUrl;return url?url.replace(new URL(url).origin,import.meta.env["VITE_SUPABASE_URL"]):null;};
 return {driver:{id:driver.id,first_name:driver.first_name,last_name:driver.last_name,matricule:driver.matricule,status:driver.status,account_status:driver.account_status,created_at:driver.created_at},dossier:{...dossier,internal_comment:manager?dossier.internal_comment:""},documents:await Promise.all((docs.data??[]).map(async d=>({...d,url:await signed("member-documents",d.path)}))),cards:await Promise.all((cards.data??[]).map(async c=>({...c,photo:await signed("photos",c.photo_path),signature:await signed("member-documents",c.signature_path),stamp:await signed("member-documents",c.stamp_path)}))),notifications:notes.data??[],settings:settings.data,manager:!!manager,photo:await signed("photos",dossier.confirmed_photo_path),original:await signed("photos",dossier.original_photo_path)};
}
export const membershipAction=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>membershipActionSchema.parse(d)).handler(({data,context})=>runMembership(context,data));
export type MembershipResult=Awaited<ReturnType<typeof runMembership>>;