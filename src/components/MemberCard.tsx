import { forwardRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { gieQuery } from "@/lib/gie";
import { dateFr } from "@/lib/format";

export type CardMember = { first_name: string; last_name: string; matricule: string; join_date: string; photo_url: string | null };

function SenegalFlag() {
  return (
    <svg viewBox="0 0 30 20" className="h-4 w-6 rounded-[2px]" aria-label="Drapeau du Sénégal">
      <rect width="10" height="20" fill="#00853F" /><rect x="10" width="10" height="20" fill="#FDEF42" /><rect x="20" width="10" height="20" fill="#E31B23" />
      <polygon fill="#00853F" points="15,6.5 15.9,9.2 18.8,9.2 16.5,10.9 17.3,13.6 15,12 12.7,13.6 13.5,10.9 11.2,9.2 14.1,9.2" />
    </svg>
  );
}

/** Carte au format ID-1 (85.6 × 54 mm), rendue à 856×540 px. */
export const MemberCard = forwardRef<HTMLDivElement, { member: CardMember }>(function MemberCard({ member: m }, ref) {
  const { data } = useQuery(gieQuery);
  const s = data?.settings;
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!m.photo_url) return;
    // Data URL so the photo survives export to PNG/PDF.
    supabase.storage.from("photos").download(m.photo_url).then(({ data: blob }) => {
      if (!blob) return;
      const r = new FileReader();
      r.onload = () => setPhoto(r.result as string);
      r.readAsDataURL(blob);
    });
  }, [m.photo_url]);

  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verifier/${encodeURIComponent(m.matricule)}` : m.matricule;

  return (
    <div ref={ref} className="relative flex h-[540px] w-[856px] flex-col overflow-hidden rounded-[28px] bg-navy font-sans text-navy-foreground">
      <div className="bg-gold-gradient absolute inset-x-0 top-0 h-3" />
      <div className="bg-gold-gradient absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-15" />
      {/* En-tête */}
      <div className="flex items-center gap-4 px-10 pt-9">
        {s?.logo_data ? <img src={s.logo_data} alt="" className="h-20 w-20 rounded-xl bg-card object-contain p-1" />
          : <div className="bg-gold-gradient grid h-20 w-20 place-items-center rounded-xl font-display text-xl font-extrabold text-navy">BGG</div>}
        <div className="flex-1">
          <div className="font-display text-[26px] font-extrabold leading-tight tracking-tight">{s?.official_name ?? "GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL"}</div>
          <div className="mt-1 text-[15px] italic text-gold">« {s?.slogan} »</div>
        </div>
        <SenegalFlag />
      </div>
      {/* Corps */}
      <div className="mt-6 flex flex-1 gap-7 px-10">
        <div className="h-[200px] w-[160px] shrink-0 overflow-hidden rounded-xl border-4 border-gold bg-card">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><User className="h-16 w-16" /></div>}
        </div>
        <div className="flex-1 space-y-3">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Carte de membre</div>
          <div>
            <div className="text-[11px] uppercase opacity-60">Prénom et nom</div>
            <div className="font-display text-[28px] font-bold leading-tight">{m.first_name} {m.last_name.toUpperCase()}</div>
          </div>
          <div className="flex gap-10">
            <div><div className="text-[11px] uppercase opacity-60">Matricule</div><div className="font-mono text-xl font-bold text-gold">{m.matricule}</div></div>
            <div><div className="text-[11px] uppercase opacity-60">Adhésion</div><div className="text-xl font-semibold">{dateFr(m.join_date)}</div></div>
          </div>
          <div className="flex items-end gap-8 pt-2">
            <div>
              {s?.signature_data ? <img src={s.signature_data} alt="" className="h-12 max-w-[170px] object-contain invert" /> : <div className="h-12" />}
              <div className="border-t border-gold/60 pt-1 text-[11px]">Le Président, <b>{s?.president_name}</b></div>
            </div>
            <div className="grid h-[70px] w-[70px] place-items-center rounded-full border-2 border-dashed border-gold/60 text-center text-[9px] uppercase opacity-70">Cachet<br />du GIE</div>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="rounded-xl bg-card p-2.5"><QRCodeSVG value={verifyUrl} size={130} /></div>
          <div className="mt-1.5 text-[10px] opacity-70">Scanner pour vérifier</div>
        </div>
      </div>
      {/* Pied */}
      <div className="bg-gold-gradient flex justify-around px-6 py-2.5 text-[12px] font-semibold text-navy">
        {(data?.contacts ?? []).map((c) => <span key={c.id}>{c.role_label.replace(/^L[ea] /, "")} : {c.phone}</span>)}
      </div>
    </div>
  );
});
