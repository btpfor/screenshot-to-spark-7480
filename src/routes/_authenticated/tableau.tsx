import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/tableau")({
  head: () => ({ meta: [
    { title: "Votre espace — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Accès à votre espace personnel ou à l'administration du GIE." },
    { property: "og:title", content: "Votre espace — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Accès sécurisé aux espaces du GIE." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Dispatch,
});

function Dispatch() {
  const { loading, isStaff, user } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;
  if (user?.user_metadata?.["must_change_password"] === true) return <Navigate to="/changer-mot-de-passe" />;
  return isStaff ? <Navigate to="/admin" /> : <Navigate to="/espace" />;
}
