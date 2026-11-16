import { z } from "zod";
export const dossierLabels: Record<string,string> = { profil_a_completer: "Profil à compléter", incomplet: "Dossier incomplet", soumis: "Dossier soumis", verification: "En cours de vérification", correction: "Correction demandée", valide: "Dossier validé", rejete: "Dossier rejeté" };
export const editableDossier = (status: string) => ["profil_a_completer","incomplet","correction"].includes(status);
const text = z.string().trim().max(200).default("");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null);
export const profileSchema = z.object({
 first_name:text,last_name:text,phone:z.string().trim().max(20).default(""),birth_date:date,birth_place:text,sex:text,address:text,region:text,department:text,commune:text,secondary_phone:text,email:z.union([z.string().email(),z.literal("")]).default(""),identity_type:text,cni_number:z.string().trim().regex(/^[a-z0-9]{3,40}$/i).nullable().default(null),identity_issued:date,identity_expiry:date,license_number:text,license_category:text,license_issued:date,license_expiry:date,original_photo_path:z.string().max(250).nullable().default(null),confirmed_photo_path:z.string().max(250).nullable().default(null),photo_confirmed:z.boolean().default(false),public_photo_consent:z.boolean().default(false),certified:z.boolean().default(false)
});
export type ProfileInput = z.infer<typeof profileSchema>;
export function missingProfile(p: Partial<ProfileInput>) {
 const required: [keyof ProfileInput,string][] = [["first_name","Prénom"],["last_name","Nom"],["phone","Téléphone"],["birth_date","Date de naissance"],["birth_place","Lieu de naissance"],["address","Adresse"],["region","Région"],["department","Département"],["commune","Commune"],["cni_number","Numéro CNI"],["license_number","Permis"],["license_category","Catégorie du permis"]];
 return [...required.filter(([k])=>!p[k]).map(([,label])=>label),...(!p.photo_confirmed||!p.confirmed_photo_path?["Photo confirmée"]:[]),...(!p.certified?["Certification"]:[])];
}
export function cardStatus(status:string,memberStatus:string,account:string,start:string,end:string,today:string) {
 if (["cancelled","replaced"].includes(status)) return "invalide";
 if(status==="suspended"||memberStatus!=="actif"||account!=="actif") return "suspendue";
 if(today>end) return "expiree";
 return today<start?"invalide":"valide";
}