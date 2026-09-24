import { Check, Lock, AlertTriangle } from "lucide-react";
import { STAGES } from "@/lib/spec/stages";
import type { Project, StageId } from "@/lib/spec/types";
import { cn } from "@/lib/utils";

interface Props {
  project: Project;
  active: StageId;
  onSelect: (id: StageId) => void;
  progress: number;
}

export function ProjectMap({ project, active, onSelect, progress }: Props) {
  return (
    <aside className="flex w-[248px] flex-none flex-col gap-1 overflow-hidden rounded-[10px] bg-panel/60 p-3 ring-1 ring-black/5 backdrop-blur-xl">
      <p className="px-1 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Mapa do projeto
      </p>

      <div className="mb-1 flex items-center gap-2 px-1">
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-line/40">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{progress}%</span>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <span className="absolute bottom-2 left-[11px] top-2 w-px bg-line/60" />
        {STAGES.map((stage) => {
          const state = project.stages[stage.id];
          const isActive = active === stage.id;
          const locked = state.status === "bloqueada";

          return (
            <button
              key={stage.id}
              type="button"
              disabled={locked}
              onClick={() => onSelect(stage.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-1 py-[7px] text-left text-[12px] transition-colors",
                isActive && "bg-amber/10 font-semibold ring-1 ring-amber/30",
                !isActive && !locked && "hover:bg-ink/5",
                locked && "cursor-not-allowed text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "z-10 grid size-[22px] flex-none place-items-center rounded-full font-mono text-[10px]",
                  state.status === "concluida" && "bg-green text-ink-foreground",
                  state.status === "andamento" && "bg-amber text-ink-foreground",
                  state.status === "pendente" && "bg-line/30 text-foreground",
                  locked && "bg-line/20 text-muted-foreground",
                )}
              >
                {state.status === "concluida" ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : locked ? (
                  <Lock className="size-3" />
                ) : (
                  stage.num
                )}
              </span>
              <span className={cn("flex-1 truncate", state.status === "concluida" && !isActive && "text-muted-foreground")}>
                {stage.num}. {stage.title}
              </span>
              {state.stale && <AlertTriangle className="size-3 flex-none text-amber" />}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line/40 pt-3">
        <span className="font-mono text-[10px] text-muted-foreground">pendente</span>
        <span className="size-2 rounded-full bg-line" />
        <span className="font-mono text-[10px] text-muted-foreground">em andamento</span>
        <span className="size-2 rounded-full bg-amber" />
        <span className="font-mono text-[10px] text-muted-foreground">concluída</span>
        <span className="size-2 rounded-full bg-green" />
      </div>
    </aside>
  );
}
