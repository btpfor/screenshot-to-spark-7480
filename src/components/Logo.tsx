import { useQuery } from "@tanstack/react-query";
import { Bus } from "lucide-react";
import { gieQuery } from "@/lib/gie";

export function Logo({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery(gieQuery);
  const logo = data?.settings?.logo_data;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logo ? (
        <img src={logo} alt="Logo du GIE" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-contain" />
      ) : (
        <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary text-gold">
          <Bus className="h-5 w-5" />
          <span className="flag-bar absolute inset-x-0 bottom-0 h-1" />
        </div>
      )}
      {!compact && (
        <div className="min-w-0 break-words leading-tight">
          <div className="font-display text-sm font-bold tracking-tight">GIE VIP BOK GUIS GUIS</div>
          <div className="text-[10px] font-semibold uppercase opacity-70">Transport Sénégal</div>
        </div>
      )}
    </div>
  );
}
