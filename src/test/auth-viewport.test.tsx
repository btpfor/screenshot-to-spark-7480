import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthViewport } from "@/hooks/use-auth-viewport";

function Harness() {
  const ref = useAuthViewport();
  return <div ref={ref} data-testid="page"><div data-auth-controls><input aria-label="Identifiant" /><button>Connexion</button></div></div>;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Sign-in visual viewport", () => {
  it("reserves the iPhone keyboard inset and scrolls controls above it", () => {
    const viewport = Object.assign(new EventTarget(), { height: 360, offsetTop: 0, scale: 1 });
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 667);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const scroll = vi.fn();
    vi.stubGlobal("scrollBy", scroll);
    render(<Harness />);
    const input = screen.getByLabelText("Identifiant");
    const controls = input.parentElement;
    if (!controls) throw new Error("Missing controls");
    vi.spyOn(controls, "getBoundingClientRect").mockReturnValue({ height: 240, top: 200, bottom: 440 } as DOMRect);
    act(() => { input.focus(); });
    act(() => { frames.splice(0).forEach(frame => frame(0)); });
    expect(screen.getByTestId("page").style.getPropertyValue("--auth-keyboard-space")).toBe("307px");
    expect(scroll).toHaveBeenCalledWith(0, 92);
    act(() => { input.blur(); });
    act(() => { frames.splice(0).forEach(frame => frame(0)); });
    expect(screen.getByTestId("page").style.getPropertyValue("--auth-keyboard-space")).toBe("0px");
  });

  it("does not treat pinch zoom as a keyboard and removes viewport listeners", () => {
    const viewport = Object.assign(new EventTarget(), { height: 300, offsetTop: 0, scale: 2 });
    const remove = vi.spyOn(viewport, "removeEventListener");
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 667);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frame = callback; return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const scroll = vi.fn();
    vi.stubGlobal("scrollBy", scroll);
    const { unmount } = render(<Harness />);
    act(() => { screen.getByLabelText("Identifiant").focus(); });
    act(() => { frame?.(0); });
    expect(screen.getByTestId("page").style.getPropertyValue("--auth-keyboard-space")).toBe("0px");
    expect(scroll).not.toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});