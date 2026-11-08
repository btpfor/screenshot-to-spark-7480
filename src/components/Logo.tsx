import { Bus } from "lucide-react";

// Emplacement du logo officiel : remplacez l'icône par <img src=... /> quand le logo est fourni.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
        <Bus className="h-5 w-5" />
        <span className="flag-bar absolute inset-x-0 bottom-0 h-1" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-sm font-bold tracking-tight">GIE VIP BOK GUIS GUIS</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">Transport Sénégal</div>
        </div>
      )}
    </div>
  );
}
