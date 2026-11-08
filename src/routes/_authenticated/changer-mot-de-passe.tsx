import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/changer-mot-de-passe")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — GIE" }, { name: "robots", content: "noindex" }] }),
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
    if (pw !== pw2) return toast.error("Les mots de passe ne correspondent pas.");
    if (pw.length < 8) return toast.error("8 caractères minimum.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: current } as never);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.rpc("mark_password_changed");
    toast.success("Mot de passe modifié.");
    navigate({ to: "/espace" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <Logo />
        <div>
          <h1 className="text-2xl font-bold">Choisissez votre mot de passe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pour votre sécurité, remplacez le mot de passe temporaire remis par l'administration.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="c">Mot de passe temporaire</Label><Input id="c" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="n">Nouveau mot de passe</Label><Input id="n" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="n2">Confirmer</Label><Input id="n2" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>Enregistrer</Button>
      </form>
    </div>
  );
}
