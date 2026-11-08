import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Download, Ellipsis, PlusSquare, Share, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { installationPlatform } from "@/lib/pwa-policy";
import { initializeAppWorker } from "@/lib/pwa";
import { cn } from "@/lib/utils";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const InstallContext = createContext({ installed: false, install: () => {} });

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [platform, setPlatform] = useState("desktop");
  const [guide, setGuide] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const detect = () => setInstalled(display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    detect();
    setPlatform(installationPlatform(navigator.userAgent, navigator.maxTouchPoints));
    const connection = () => setOffline(!navigator.onLine);
    connection();
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const completed = () => {
      setInstalled(true); setPrompt(null); setGuide(false);
      toast.success("Félicitations ! L’application GIE VIP BOK GUIS GUIS est installée sur votre appareil.");
    };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", completed);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    display.addEventListener("change", detect);
    void initializeAppWorker().catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", completed);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      display.removeEventListener("change", detect);
    };
  }, []);
  const install = async () => {
    if (installed || busy) return;
    if (!prompt) { setGuide(true); return; }
    setBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
    catch { setGuide(true); }
    finally { setBusy(false); }
  };
  return <InstallContext.Provider value={{ installed, install }}>
    {offline && <div role="status" className="no-print flex items-center justify-center gap-2 border-b bg-accent px-4 py-3 text-center text-sm text-accent-foreground"><WifiOff className="h-4 w-4 shrink-0" />Hors connexion — Internet est nécessaire pour vous connecter et consulter ou modifier vos données.</div>}
    {children}
    <Dialog open={guide} onOpenChange={setGuide}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg">
        <DialogHeader>
          <img src="/icons/app-192.png" alt="Emblème du GIE" className="mb-3 h-16 w-16 rounded-lg" />
          <DialogTitle>Installer l’application</DialogTitle>
          <DialogDescription>{platform === "ios" ? "Sur iPhone et iPad, utilisez Safari." : "Utilisez le menu de votre navigateur pour installer VIP BOK GUIS GUIS."}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-5">
          {(platform === "ios" ? [
            { icon: Share, title: "Ouvrir le menu de partage", text: "Dans Safari, touchez le carré avec une flèche vers le haut, ou le menu ⋯ puis Partager." },
            { icon: PlusSquare, title: "Sur l’écran d’accueil", text: "Sélectionnez cette option dans le menu de partage." },
            { icon: CheckCircle2, title: "Ajouter", text: "Activez « Ouvrir comme app » si proposé, puis appuyez sur Ajouter." },
          ] : [
            { icon: Ellipsis, title: "Ouvrir le menu du navigateur", text: platform === "android" ? "Dans Chrome ou Samsung Internet, touchez le menu ⋮ ou ☰." : "Dans Chrome ou Edge, ouvrez le menu ⋯ ou l’icône d’installation près de l’adresse." },
            { icon: Download, title: "Installer ou ajouter à l’écran d’accueil", text: "Choisissez Installer l’application, Applications → Installer ce site, ou Ajouter à l’écran d’accueil, selon le navigateur." },
            { icon: CheckCircle2, title: "Confirmer l’installation", text: "Si l’option manque, ouvrez le site publié dans un navigateur compatible, hors de l’aperçu Lovable." },
          ]).map((step, i) => <li key={step.title} className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><step.icon className="h-6 w-6" /></div><div><h3 className="text-sm font-semibold">{i + 1}. {step.title}</h3><p className="mt-1 text-sm text-muted-foreground">{step.text}</p></div></li>)}
        </ol>
        <Button onClick={() => setGuide(false)} className="mt-2">Compris</Button>
      </DialogContent>
    </Dialog>
  </InstallContext.Provider>;
}

export function InstallAppButton({ className }: { className?: string }) {
  const { installed, install } = useContext(InstallContext);
  if (installed) return <span className={cn("inline-flex items-center gap-2 text-xs", className)}><CheckCircle2 className="h-4 w-4 shrink-0" />Application déjà installée</span>;
  return <Button type="button" size="sm" onClick={install} className={cn("h-auto min-h-9 whitespace-normal bg-accent py-2 text-accent-foreground hover:bg-accent/90", className)}><Download className="shrink-0" />Installer l’application</Button>;
}