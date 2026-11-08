import { useQuery } from "@tanstack/react-query";
import { gieQuery } from "@/lib/gie";
import officialLogo from "@/assets/logo-gie-vip-transport.jpeg.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery(gieQuery);
  const logo = data?.settings?.logo_data || officialLogo.url;
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <img src={logo} alt="Logo officiel du GIE VIP Transport Sénégal" width={56} height={56} className="h-12 w-12 shrink-0 rounded-full object-contain sm:h-14 sm:w-14" onError={(event) => {
        if (event.currentTarget.getAttribute("src") !== officialLogo.url) event.currentTarget.src = officialLogo.url;
      }} />
      {!compact && (
        <div className="min-w-0 break-words leading-tight">
          <div className="font-display text-sm font-bold tracking-normal">GIE VIP BOK GUIS GUIS</div>
          <div className="text-[10px] font-semibold uppercase opacity-70">Transport Sénégal</div>
        </div>
      )}
    </div>
  );
}
