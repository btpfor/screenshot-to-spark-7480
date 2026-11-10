import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [visible, setVisible] = useState<Record<string, boolean>>({});

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
        {[
          { id: "c", label: "Mot de passe actuel", value: current, onChange: setCurrent, autoComplete: "current-password" },
          { id: "n", label: "Nouveau mot de passe", value: pw, onChange: setPw, autoComplete: "new-password", minLength: 6 },
          { id: "n2", label: "Confirmer", value: pw2, onChange: setPw2, autoComplete: "new-password" },
        ].map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <div className="relative">
              <Input id={field.id} className="h-11 pr-12" type={visible[field.id] ? "text" : "password"} autoComplete={field.autoComplete} required minLength={field.minLength} value={field.value} onChange={(e) => field.onChange(e.target.value)} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11 text-muted-foreground" aria-controls={field.id} aria-pressed={!!visible[field.id]} aria-label={`${visible[field.id] ? "Masquer" : "Afficher"} le mot de passe — ${field.label}`} title={`${visible[field.id] ? "Masquer" : "Afficher"} le mot de passe`} onClick={() => setVisible((previous) => ({ ...previous, [field.id]: !previous[field.id] }))}>
                {visible[field.id] ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </div>
        ))}
        <Button className="w-full" disabled={busy}>Enregistrer</Button>
      </form>
    </div>
  );
}
