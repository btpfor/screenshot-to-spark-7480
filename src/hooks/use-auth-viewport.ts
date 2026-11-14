import { useEffect, useRef } from "react";

/** Keep native document scrolling; iOS keyboards shrink only the visual viewport. */
export function useAuthViewport() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const viewport = window.visualViewport;
    let frame = 0;
    let timer = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        const typing = active instanceof HTMLInputElement && root.contains(active);
        const mobile = window.matchMedia("(max-width: 767px)").matches;
        // Do not interpret pinch zoom as a keyboard or restrict user zooming.
        const unzoomed = !viewport || Math.abs(viewport.scale - 1) < 0.05;
        const inset = mobile && typing && unzoomed && viewport
          ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
          : 0;
        root.style.setProperty("--auth-keyboard-space", `${inset}px`);
        if (!mobile || !typing || !unzoomed) return;

        const controls = root.querySelector<HTMLElement>("[data-auth-controls]");
        const height = viewport?.height ?? window.innerHeight;
        const top = (viewport?.offsetTop ?? 0) + 12;
        const bottom = top + height - 24;
        const target = controls && controls.getBoundingClientRect().height <= height - 24
          ? controls : active;
        const bounds = target.getBoundingClientRect();
        if (bounds.bottom > bottom) window.scrollBy(0, bounds.bottom - bottom);
        else if (bounds.top < top) window.scrollBy(0, bounds.top - top);
      });
    };
    const onFocus = () => {
      update();
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 350);
    };
    root.addEventListener("focusin", onFocus);
    root.addEventListener("focusout", onFocus);
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("focusout", onFocus);
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);

  return ref;
}