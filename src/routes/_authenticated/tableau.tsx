import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/tableau")({
  component: Dispatch,
});

function Dispatch() {
  const { loading, isStaff } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;
  return isStaff ? <Navigate to="/admin" /> : <Navigate to="/espace" />;
}
