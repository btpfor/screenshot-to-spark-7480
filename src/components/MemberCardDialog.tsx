import { useRef, useState } from "react";
import { Download, FileImage } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MemberCard, type CardMember } from "./MemberCard";

/** Shows a member card scaled to fit, with PNG and PDF download. */
export function MemberCardView({ member }: { member: CardMember }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const toPng = async () => {
    const { toPng } = await import("html-to-image");
    return toPng(ref.current!, { pixelRatio: 2.5, cacheBust: true });
  };
  const file = `carte-${member.matricule}`;
  const png = async () => {
    setBusy(true);
    try { const url = await toPng(); const a = document.createElement("a"); a.href = url; a.download = `${file}.png`; a.click(); }
    catch { toast.error("Export impossible"); }
    setBusy(false);
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const url = await toPng();
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
      doc.addImage(url, "PNG", 0, 0, 85.6, 54);
      doc.save(`${file}.pdf`);
    } catch { toast.error("Export impossible"); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="w-full overflow-hidden" style={{ height: "calc(540px * var(--card-scale))" }}>
        <div className="origin-top-left" style={{ width: 856, transform: "scale(var(--card-scale))" }}>
          <MemberCard ref={ref} member={member} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={pdf} disabled={busy}><Download className="mr-1 h-4 w-4" /> PDF</Button>
        <Button size="sm" variant="outline" onClick={png} disabled={busy}><FileImage className="mr-1 h-4 w-4" /> Image</Button>
      </div>
    </div>
  );
}

/** Wrapper that measures available width and sets --card-scale. */
export function ScaledCard({ member }: { member: CardMember }) {
  const [scale, setScale] = useState(0.5);
  return (
    <div
      ref={(el) => {
        if (!el) return;
        const update = () => setScale(Math.min(1, el.clientWidth / 856));
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
      }}
      style={{ ["--card-scale" as string]: scale }}
    >
      <MemberCardView member={member} />
    </div>
  );
}
