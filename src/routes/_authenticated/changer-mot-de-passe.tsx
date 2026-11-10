import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { passwordChangeError } from "@/lib/password-rules";

export const Route = createFileRoute("/_authenticated/changer-mot-de-passe")({
  head: () => ({ meta: [
    { title: "Nouveau mot de passe — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Remplacez votre mot de passe pour sécuriser votre accès au GIE." },
    { property: "og:title", content: "Nouveau mot de passe — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Changement sécurisé de votre mot de passe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ChangePassword,
});

function ChangePassword() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = passwordChangeError(current, pw, pw2);
    if (validationError) { toast.error(validationError); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw, current_password: current, data: { must_change_password: false } });
      if (error) { toast.error("Modification impossible. Vérifiez votre mot de passe actuel puis réessayez."); return; }
      const { error: markError } = await supabase.rpc("mark_password_changed");
      if (markError) { toast.error("Mot de passe modifié, mais confirmation impossible. Réessayez de vous connecter."); return; }
      toast.success("Mot de passe modifié.");
      navigate({ to: "/tableau" });
    } catch {
      toast.error("Connexion interrompue. Réessayez.");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <Logo />
        <div>
          <h1 className="text-2xl font-bold">Choisissez votre mot de passe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pour votre sécurité, remplacez le mot de passe temporaire remis par l'administration.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="c">Mot de passe actuel</Label><Input id="c" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="n">Nouveau mot de passe</Label><Input id="n" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="n2">Confirmer</Label><Input id="n2" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>Enregistrer</Button>
      </form>
    </div>
  );
}
