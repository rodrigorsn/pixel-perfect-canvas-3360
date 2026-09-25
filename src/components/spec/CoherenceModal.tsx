import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CoherenceIssue } from "@/lib/spec/types";
import { cn } from "@/lib/utils";

const SEVERITY_LABEL: Record<CoherenceIssue["severity"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const SEVERITY_ORDER: Record<CoherenceIssue["severity"], number> = {
  alta: 0,
  media: 1,
  baixa: 2,
};

const SEVERITY_COLOR: Record<CoherenceIssue["severity"], string> = {
  alta: "text-destructive",
  media: "text-amber",
  baixa: "text-muted-foreground",
};

export function CoherenceModal({
  issues,
  stageName,
  onCancel,
  onApproveAnyway,
}: {
  issues: CoherenceIssue[] | null;
  stageName: string | null;
  onCancel: () => void;
  onApproveAnyway: () => void;
}) {
  const sorted = issues
    ? [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    : [];

  return (
    <Dialog open={!!issues} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[640px] gap-4 bg-panel">
        <DialogHeader>
          <DialogTitle className="font-display text-[14px]">
            Contradições encontradas — {stageName ?? "etapa"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
          {sorted.map((issue, index) => (
            <div key={index} className="rounded-md bg-panel/60 p-3 ring-1 ring-line/60">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className={cn("size-3.5", SEVERITY_COLOR[issue.severity])} />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {SEVERITY_LABEL[issue.severity]}
                </span>
                <span className="text-[13px] font-semibold">{issue.title}</span>
              </div>
              <p className="mb-2 text-[12px] leading-relaxed text-foreground/90">
                {issue.description}
              </p>
              <p className="mb-1 font-mono text-[10px] text-muted-foreground">
                {issue.locations.join(" · ")}
              </p>
              <p className="text-[12px] leading-relaxed text-accent">{issue.suggestion}</p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-line hover:bg-ink/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onApproveAnyway}
            className="rounded-md bg-green px-3 py-1.5 text-[12px] font-medium text-ink-foreground"
          >
            Aprovar mesmo assim
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
