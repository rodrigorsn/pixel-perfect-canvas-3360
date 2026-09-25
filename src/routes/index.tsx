import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Package, RotateCcw } from "lucide-react";
import { ChatPanel } from "@/components/spec/ChatPanel";
import { DocumentPanel } from "@/components/spec/DocumentPanel";
import { ExportDialog } from "@/components/spec/ExportDialog";
import { ImplementationPanel, VerificationPanel } from "@/components/spec/TrackerPanels";
import { ProjectMap } from "@/components/spec/ProjectMap";
import { buildFileMap } from "@/lib/spec/export";
import { stageById } from "@/lib/spec/stages";
import { useProject } from "@/lib/spec/useProject";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spec Studio — planejamento de software com IA" },
      {
        name: "description",
        content:
          "Planeje seu app etapa por etapa com um arquiteto de IA e exporte um pacote de documentos e tarefas pronto para agentes de código.",
      },
      { property: "og:title", content: "Spec Studio — planejamento de software com IA" },
      {
        property: "og:description",
        content:
          "Do brainstorm às tarefas: documentos markdown e um pacote pronto para Claude Code, Codex, Cursor e Antigravity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

function Studio() {
  const app = useProject();
  const [exportOpen, setExportOpen] = useState(false);
  const stage = stageById(app.activeStage);
  const rawState = app.project.stages[app.activeStage];
  const canExport = app.project.stages.tarefas.status === "concluida";
  const [chatWidth, setChatWidth] = useState(480);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startWidth: chatWidth };
      const onMove = (move: PointerEvent) => {
        const start = dragRef.current;
        if (!start) return;
        const next = start.startWidth + (move.clientX - start.startX);
        setChatWidth(Math.min(760, Math.max(320, next)));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [chatWidth],
  );

  const state = useMemo(() => {
    if (app.activeStage === "implementacao") {
      return { ...rawState, doc: buildFileMap(app.project)["STATUS.md"] ?? "" };
    }
    if (app.activeStage === "verificacao") {
      return {
        ...rawState,
        doc: app.project.verification.length
          ? `# Verificação\n\n${app.project.verification
              .map((item) => `- [${item.done ? "x" : " "}] ${item.text}`)
              .join("\n")}`
          : "",
      };
    }
    return rawState;
  }, [app.activeStage, app.project, rawState]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background font-body text-foreground">
      <header className="z-20 flex h-[52px] flex-none items-center gap-4 bg-panel/70 px-4 ring-1 ring-black/5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="grid size-[18px] place-items-center rounded-[5px] bg-accent font-mono text-[10px] text-accent-foreground">
            S
          </span>
          <span className="font-display text-[13px] font-semibold tracking-tight">Spec Studio</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">projeto /</span>
        <input
          value={app.project.name}
          onChange={(event) => app.renameProject(event.target.value)}
          className="w-52 bg-transparent font-mono text-[11px] text-foreground outline-none"
        />

        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-[11px] text-muted-foreground">
            Etapa {stage.num} de 8
          </span>
          <div className="h-[5px] w-24 overflow-hidden rounded-full bg-line/40">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${app.progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px]">{app.progress}%</span>
          <button
            type="button"
            onClick={() => {
              if (confirm("Começar um projeto novo? O projeto atual será apagado."))
                app.resetProject("Novo projeto");
            }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-line hover:bg-ink/5"
          >
            <RotateCcw className="size-3" /> Novo projeto
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-ink-foreground disabled:opacity-40"
          >
            <Package className="size-3" /> Exportar pacote
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <ProjectMap
          project={app.project}
          active={app.activeStage}
          onSelect={app.setActiveStage}
          progress={app.progress}
        />

        <div className="flex min-h-0 flex-none flex-col" style={{ width: chatWidth }}>
          {app.activeStage === "implementacao" ? (
            <ImplementationPanel
              tasks={app.project.tasks}
              onToggle={(code, done) => app.updateTask(code, { done })}
              onImport={app.importStatus}
            />
          ) : app.activeStage === "verificacao" ? (
            <VerificationPanel
              project={app.project}
              items={app.project.verification}
              onToggle={app.toggleVerification}
              onRebuild={app.buildVerification}
            />
          ) : (
            <ChatPanel
              stage={stage}
              state={state}
              busy={app.busy}
              onSend={app.sendMessage}
              onGenerate={() => app.generateDoc()}
            />
          )}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          title="Arraste para redimensionar"
          onPointerDown={onHandlePointerDown}
          className="group flex w-2 flex-none cursor-col-resize items-center justify-center"
        >
          <div className="h-10 w-[3px] rounded-full bg-line/60 transition-colors group-hover:bg-accent group-active:bg-accent" />
        </div>

        <DocumentPanel
          stage={stage}
          state={state}
          project={app.project}
          busy={app.busy}
          onGenerate={() => app.generateDoc()}
          onApprove={() => app.approveStage(app.activeStage)}
          onReopen={() => app.reopenStage(app.activeStage)}
          onDocChange={(value) => app.setDoc(app.activeStage, value)}
          onFeatureChange={app.updateFeature}
          onFeatureRemove={app.removeFeature}
          onFeatureMove={app.moveFeature}
          onFeatureAdd={app.addFeature}
          onTaskChange={app.updateTask}
          onRegenerateFeatureTasks={app.regenerateFeatureTasks}
          onGenerateWireframe={app.generateWireframe}
        />
      </div>

      <ExportDialog
        project={app.project}
        open={exportOpen}
        onOpenChange={setExportOpen}
        busy={app.busy}
        onGenerateAgents={app.generateAgentsMd}
        onAgentsChange={app.setAgentsMd}
      />
    </div>
  );
}
