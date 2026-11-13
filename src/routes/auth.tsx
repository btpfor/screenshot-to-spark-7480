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
import { officialLogoUrl } from "@/lib/branding";
import sedan from "@/assets/auth-sedan.png";
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
    if (!navigator.onLine) {
      setError("Vous êtes hors connexion. Connectez-vous à Internet pour accéder à votre compte.");
      return;
    }
    if (!id.includes("@") && !isMatricule(id)) {
      setError("Saisissez votre adresse email, votre identifiant vipbgg-123 ou votre ancien matricule BGG-2026-0001.");
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
      <div className="auth-stage relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex">
        <div className="auth-glow" aria-hidden="true" />
        <Link to="/" className="relative z-10"><Logo /></Link>
        <div className="relative z-10 flex flex-col items-center">
          <div className="auth-logo-3d" aria-hidden="true">
            <img src={officialLogoUrl} alt="" className="auth-logo-face" />
            <div className="auth-logo-shadow" />
          </div>
          <div className="auth-road mt-10 w-full" aria-hidden="true">
            <img src={sedan} alt="" width={1235} height={380} className="auth-car" />
            <div className="auth-lane" />
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Transport VIP · Sénégal</p>
          <h2 className="mt-2 text-3xl font-bold text-sidebar-accent-foreground">Votre GIE, dans votre poche.</h2>
          <p className="mt-3 max-w-sm opacity-75">Les comptes membres sont créés par l'administration. Vos identifiants vous sont remis par le secrétariat.</p>
          <div className="flag-bar mt-6 h-1.5 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex min-w-0 items-center justify-center bg-muted/40 p-4 sm:p-6">
        <form onSubmit={submit} className="auth-card min-w-0 w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
          <div className="md:hidden">
            <Logo />
            <div className="auth-hero-mobile mt-4 overflow-hidden rounded-xl bg-sidebar p-4 text-sidebar-foreground">
              <div className="flex items-center gap-4">
                <div className="auth-logo-3d auth-logo-3d-sm shrink-0" aria-hidden="true">
                  <img src={officialLogoUrl} alt="" className="auth-logo-face" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Transport VIP · Sénégal</p>
                  <p className="mt-1 text-sm font-bold text-sidebar-accent-foreground">Votre GIE, dans votre poche.</p>
                </div>
              </div>
              <div className="auth-road auth-road-sm mt-2 w-full" aria-hidden="true">
                <img src={sedan} alt="" width={1235} height={380} className="auth-car auth-car-sm" />
                <div className="auth-lane" />
              </div>
              <div className="flag-bar h-1 w-16 rounded-full" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{needsAdmin ? "Configuration initiale" : "Connexion"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsAdmin ? "Créez le compte du super administrateur. Cette étape n'apparaît qu'une seule fois." : "Saisissez votre identifiant : adresse email ou numéro matricule."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="id">Identifiant</Label>
            <Input id="id" required autoComplete="username" type="text" value={id} onChange={(e) => { setId(e.target.value); setError(""); }} placeholder="vipbgg-123 ou email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Mot de passe</Label>
            <div className="relative">
              <Input id="pw" type={showPassword ? "text" : "password"} required minLength={needsAdmin ? 8 : 6} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="pr-12" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-controls="pw"
                aria-pressed={showPassword}
                className="absolute right-0 top-0 h-full w-11 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>Se connecter</Button>
        </form>
      </div>
    </div>
  );
}
