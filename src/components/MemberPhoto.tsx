import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function MemberPhoto({ path, className = "h-10 w-10" }: { path: string | null | undefined; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return setUrl(null);
    supabase.storage.from("photos").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  return url ? (
    <img src={url} alt="" className={`${className} rounded-full object-cover`} />
  ) : (
    <div className={`${className} grid place-items-center rounded-full bg-muted text-muted-foreground`}><User className="h-1/2 w-1/2" /></div>
  );
}
