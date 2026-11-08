import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { isMatricule, loginToEmail } from "@/lib/member-ids";
import { bootstrapSuperAdmin, hasSuperAdmin } from "@/lib/members.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — GIE VIP BOK GUIS GUIS" },
      { name: "description", content: "Connexion à l'espace membre et administrateur avec votre identifiant." },
      { property: "og:title", content: "Connexion — GIE VIP BOK GUIS GUIS" },
      { property: "og:description", content: "Espace membre et administration du GIE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(hasSuperAdmin);
  const bootstrap = useServerFn(bootstrapSuperAdmin);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkAdmin().then((ok) => setNeedsAdmin(!ok)).catch(() => {});
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/tableau" }); });
  }, [checkAdmin, navigate]);

  const signIn = async (email: string) => {
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      const msg = authError.message.toLowerCase().includes("banned")
        ? "Ce compte est désactivé ou bloqué. Contactez l'administration."
        : "Identifiant ou mot de passe incorrect. Vérifiez votre identifiant et votre mot de passe, puis réessayez.";
      setError(msg);
      toast.error(msg);
      return;
    }
    await supabase.rpc("record_login");
    navigate({ to: data.user?.user_metadata?.["must_change_password"] === true ? "/changer-mot-de-passe" : "/tableau" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!id.includes("@") && !isMatricule(id)) {
      setError("Saisissez votre adresse email ou un matricule au format BGG-2026-0001.");
      return;
    }
    setBusy(true);
    try {
      if (needsAdmin) {
        const email = loginToEmail(id);
        await bootstrap({ data: { email, password } });
        toast.success("Compte super administrateur créé.");
        setNeedsAdmin(false);
        await signIn(email);
      } else await signIn(loginToEmail(id));
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <Link to="/"><Logo /></Link>
        <div>
          <h2 className="text-3xl font-bold text-sidebar-accent-foreground">Votre GIE, dans votre poche.</h2>
          <p className="mt-3 max-w-sm opacity-75">Les comptes membres sont créés par l'administration. Vos identifiants vous sont remis par le secrétariat.</p>
        </div>
        <div className="flag-bar h-1.5 w-24 rounded-full" />
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="md:hidden"><Logo /></div>
          <div>
            <h1 className="text-2xl font-bold">{needsAdmin ? "Configuration initiale" : "Connexion"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsAdmin ? "Créez le compte du super administrateur. Cette étape n'apparaît qu'une seule fois." : "Saisissez votre identifiant : adresse email ou numéro matricule."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="id">Identifiant</Label>
            <Input id="id" required autoComplete="username" type="text" value={id} onChange={(e) => { setId(e.target.value); setError(""); }} placeholder="BGG-2026-0001" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Mot de passe</Label>
            <div className="relative">
              <Input id="pw" type={showPassword ? "text" : "password"} required minLength={needsAdmin ? 8 : 6} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="pr-10" />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>Se connecter</Button>
          {!needsAdmin && (
            <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setForgot(!forgot)}>Mot de passe oublié ?</button>
          )}
          {forgot && (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Contactez le secrétariat du GIE : un administrateur réinitialisera votre mot de passe et vous remettra un mot de passe temporaire.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
