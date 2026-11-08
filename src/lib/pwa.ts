import { appWorkerScript, refuseAppWorker } from "./pwa-policy";

export async function initializeAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (refuseAppWorker(import.meta.env.PROD, window.location.hostname.toLowerCase(), window.self !== window.top, window.location.search)) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((r) => {
      const worker = r.active ?? r.waiting ?? r.installing;
      return worker && appWorkerScript(worker.scriptURL, window.location.origin);
    }).map((r) => r.unregister()));
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true, onRegisterError: () => console.warn("L’ouverture hors connexion n’a pas pu être activée.") });
}