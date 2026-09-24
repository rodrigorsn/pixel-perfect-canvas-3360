import { useEffect, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Loader2, Plus, Trash2, UnfoldVertical, FoldVertical } from "lucide-react";
import { Markdown } from "./Markdown";
import { TelasEditor } from "./TelasEditor";
import type { StageDef } from "@/lib/spec/stages";
import type { Feature, Project, StageState, Task } from "@/lib/spec/types";
import { cn } from "@/lib/utils";

interface Props {
  stage: StageDef;
  state: StageState;
  project: Project;
  busy: string | null;
  onGenerate: () => void;
  onApprove: () => void;
  onReopen: () => void;
  onDocChange: (value: string) => void;
  onFeatureChange: (slug: string, patch: Partial<Feature>) => void;
  onFeatureRemove: (slug: string) => void;
  onFeatureMove: (slug: string, delta: number) => void;
  onFeatureAdd: (name: string) => void;
  onTaskChange: (code: string, patch: Partial<Task>) => void;
  onRegenerateFeatureTasks: (slug: string) => void;
  onGenerateWireframe: (slug: string, pageId: string) => void;
}

type Tab = "preview" | "editar";

export function DocumentPanel(props: Props) {
  const { stage, state, project, busy } = props;
  const [tab, setTab] = useState<Tab>("preview");
  const [selected, setSelected] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(null);
    setTab("preview");
    setExpanded(new Set());
  }, [stage.id]);

  const toggleTask = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const isMulti = stage.multi;
  const approved = state.status === "concluida";

  const itemDoc = (): { title: string; value: string; onChange: (v: string) => void; wireframe?: string } | null => {
    if (!selected) return null;
    if (stage.id === "tarefas") {
      const task = project.tasks.find((t) => t.code === selected);
      if (!task) return null;
      return {
        title: `${task.code} — ${task.title}`,
        value: task.markdown,
        onChange: (v) => props.onTaskChange(task.code, { markdown: v }),
      };
    }
    const feature = project.features.find((f) => f.slug === selected);
    if (!feature) return null;
    if (stage.id === "telas") {
      return {
        title: `Telas — ${feature.name}`,
        value: feature.telas,
        onChange: (v) => props.onFeatureChange(feature.slug, { telas: v }),
      };
    }
    return {
      title: feature.name,
      value: feature.spec,
      onChange: (v) => props.onFeatureChange(feature.slug, { spec: v }),
    };
  };

  const current = itemDoc();
  const telasFeature = stage.id === "telas" ? project.features.find((f) => f.slug === selected) : undefined;
  const docValue = current ? current.value : state.doc;

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-panel/60 ring-1 ring-black/5 backdrop-blur-xl">
      <div className="flex h-[42px] flex-none items-center gap-1 border-b border-line/40 px-3">
        {current && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mr-1 rounded-md p-1 text-muted-foreground hover:bg-ink/5"
          >
            <ArrowLeft className="size-3.5" />
          </button>
        )}
        {(["preview", "editar"] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] font-medium capitalize",
              tab === value ? "bg-ink/8 text-foreground" : "text-muted-foreground hover:bg-ink/5",
            )}
          >
            {value === "preview" ? "Prévia" : "Editar"}
          </button>
        ))}
        {!current && (stage.id === "tarefas" ? project.tasks.length > 0 : stage.id === "telas" && project.features.length > 0) && (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title="Expandir todas"
              onClick={() =>
                setExpanded(
                  stage.id === "tarefas"
                    ? new Set(project.tasks.map((t) => t.code))
                    : new Set(project.features.map((f) => f.slug)),
                )
              }
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-line/60 hover:bg-ink/5"
            >
              <UnfoldVertical className="size-3" /> Expandir
            </button>
            <button
              type="button"
              title="Recolher todas"
              onClick={() => setExpanded(new Set())}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-line/60 hover:bg-ink/5"
            >
              <FoldVertical className="size-3" /> Recolher
            </button>
          </span>
        )}
        <span className={cn("font-mono text-[10px] text-muted-foreground", !current && (stage.id === "tarefas" ? project.tasks.length > 0 : stage.id === "telas" && project.features.length > 0) ? "" : "ml-auto")}>{stage.docPath}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {state.stale && (
          <p className="mb-3 rounded-md bg-amber/10 px-2 py-1.5 font-mono text-[10px] text-amber ring-1 ring-amber/30">
            pode estar desatualizada — uma etapa anterior foi editada
          </p>
        )}

        {stage.id === "telas" && current && telasFeature ? (
          <TelasEditor
            key={telasFeature.slug}
            feature={telasFeature}
            busy={busy}
            onChange={(pages) => props.onFeatureChange(telasFeature.slug, { pages })}
            onGenerateWireframe={(pageId) => props.onGenerateWireframe(telasFeature.slug, pageId)}
          />
        ) : isMulti && !current ? (
          <ItemList
            stage={stage}
            project={project}
            onSelect={setSelected}
            onFeatureRemove={props.onFeatureRemove}
            onFeatureMove={props.onFeatureMove}
            newFeature={newFeature}
            setNewFeature={setNewFeature}
            onFeatureAdd={props.onFeatureAdd}
            busy={busy}
            onRegenerateFeatureTasks={props.onRegenerateFeatureTasks}
            expanded={expanded}
            onToggleTask={toggleTask}
          />
        ) : tab === "editar" ? (
          <textarea
            value={docValue}
            onChange={(event) => (current ? current.onChange(event.target.value) : props.onDocChange(event.target.value))}
            spellCheck={false}
            className="h-full min-h-[420px] w-full resize-none rounded-md bg-panel/70 p-3 font-mono text-[11.5px] leading-relaxed outline-none ring-1 ring-line/60 focus:ring-accent"
            placeholder="O markdown do documento aparece aqui."
          />
        ) : docValue ? (
          <>
            <div className="relative mb-3">
              <div className="text-balance font-display text-[16px] font-semibold tracking-tight">
                {current ? current.title : stage.title}
              </div>
              {approved && !current && (
                <span className="animate-stamp absolute -right-2 -top-1 rounded-[3px] border-2 border-green px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-green">
                  aprovado
                </span>
              )}
            </div>
            <Markdown content={docValue} />
            {current?.wireframe && (
              <div className="mt-4">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Wireframe
                </p>
                <iframe
                  title="Wireframe"
                  sandbox=""
                  srcDoc={current.wireframe}
                  className="h-[420px] w-full rounded-md bg-panel ring-1 ring-line/60"
                />
              </div>
            )}
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            Nenhum documento ainda. Converse com o arquiteto e clique em “Gerar documento”.
          </p>
        )}
      </div>

      <div className="flex flex-none gap-2 border-t border-line/40 p-3">
        <button
          type="button"
          disabled={!!busy}
          onClick={props.onGenerate}
          className={
            (() => {
              const last = state.messages[state.messages.length - 1];
              return last?.role === "assistant" && /pronto para gerar o documento/i.test(last.content);
            })()
              ? "flex-1 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground ring-2 ring-accent/60 disabled:opacity-50"
              : "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-line hover:bg-ink/5 disabled:opacity-50"
          }
        >
          {busy ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : state.doc ? "Regerar" : "Gerar documento"}
        </button>
        {approved ? (
          <button
            type="button"
            onClick={props.onReopen}
            className="flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-line hover:bg-ink/5"
          >
            Reabrir etapa
          </button>
        ) : (
          <button
            type="button"
            disabled={!state.doc}
            onClick={props.onApprove}
            className="flex-1 rounded-md bg-green px-3 py-1.5 text-[12px] font-medium text-ink-foreground disabled:opacity-40"
          >
            Aprovar etapa
          </button>
        )}
      </div>
    </section>
  );
}

function ItemList({
  stage,
  project,
  onSelect,
  onFeatureRemove,
  onFeatureMove,
  newFeature,
  setNewFeature,
  onFeatureAdd,
  busy,
  onRegenerateFeatureTasks,
  expanded,
  onToggleTask,
}: {
  stage: StageDef;
  project: Project;
  onSelect: (id: string) => void;
  onFeatureRemove: (slug: string) => void;
  onFeatureMove: (slug: string, delta: number) => void;
  newFeature: string;
  setNewFeature: (v: string) => void;
  onFeatureAdd: (name: string) => void;
  busy: string | null;
  onRegenerateFeatureTasks: (slug: string) => void;
  expanded: Set<string>;
  onToggleTask: (code: string) => void;
}) {
  if (stage.id === "tarefas") {
    if (!project.tasks.length) {
      return <p className="font-mono text-[11px] text-muted-foreground">Nenhuma tarefa gerada ainda.</p>;
    }
    return (
      <div className="flex flex-col gap-3">
        {project.features.map((feature, index) => {
          const tasks = project.tasks.filter((t) => t.featureSlug === feature.slug);
          return (
            <div key={feature.slug} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(3, "0")}-{feature.slug}
                </span>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => onRegenerateFeatureTasks(feature.slug)}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-line hover:bg-ink/5 disabled:opacity-50"
                >
                  Regerar tarefas
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {tasks.map((task) => {
                  const isOpen = expanded.has(task.code);
                  return (
                    <li key={task.code} className="rounded-md ring-1 ring-line/50">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title={isOpen ? "Recolher" : "Expandir"}
                          onClick={() => onToggleTask(task.code)}
                          className="flex-none rounded p-1.5 text-muted-foreground hover:bg-ink/5"
                        >
                          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelect(task.code)}
                          className="min-w-0 flex-1 rounded-md px-1 py-2 text-left text-[12px] hover:bg-ink/5"
                        >
                          <span className="font-mono text-[10px] text-accent">{task.code}</span>{" "}
                          <span>{task.title}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                            {task.kind === "prototype" ? "protótipo" : "funcional"}
                            {task.dependsOn.length ? ` · depende de ${task.dependsOn.join(", ")}` : ""}
                          </span>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="border-t border-line/40 px-3 py-2">
                          <Markdown content={task.markdown} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!project.features.length && (
        <p className="font-mono text-[11px] text-muted-foreground">
          Nenhuma feature ainda. Gere a lista a partir do PRD.
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {project.features.map((feature, index) => {
          const isOpen = stage.id === "telas" && expanded.has(feature.slug);
          return (
            <li key={feature.slug} className={cn("rounded-md ring-1 ring-line/50", isOpen && "flex flex-col")}>
              <div className="flex items-center gap-1">
                {stage.id === "telas" && (
                  <button
                    type="button"
                    title={isOpen ? "Recolher" : "Expandir"}
                    onClick={() => onToggleTask(feature.slug)}
                    className="flex-none rounded p-1.5 text-muted-foreground hover:bg-ink/5"
                  >
                    {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(feature.slug)}
                  className="min-w-0 flex-1 rounded-md px-1 py-2 text-left text-[12px] hover:bg-ink/5"
                >
                  <span className="font-mono text-[10px] text-accent">
                    {String(index + 1).padStart(3, "0")}-{feature.slug}
                  </span>
                  <span className="block">{feature.name}</span>
                  {stage.id === "telas" && (
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {feature.pages.length
                        ? `${feature.pages.length} ${feature.pages.length === 1 ? "página" : "páginas"}`
                        : "sem páginas"}
                    </span>
                  )}
                </button>
                {stage.id === "features" && (
                  <div className="flex flex-none items-center gap-0.5 pr-1">
                    <button type="button" onClick={() => onFeatureMove(feature.slug, -1)} className="rounded p-1 text-muted-foreground hover:bg-ink/5">
                      <ArrowUp className="size-3" />
                    </button>
                    <button type="button" onClick={() => onFeatureMove(feature.slug, 1)} className="rounded p-1 text-muted-foreground hover:bg-ink/5">
                      <ArrowDown className="size-3" />
                    </button>
                    <button type="button" onClick={() => onFeatureRemove(feature.slug)} className="rounded p-1 text-muted-foreground hover:bg-ink/5">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
              {isOpen && (
                <div className="border-t border-line/40 px-3 py-2">
                  {feature.telas ? (
                    <Markdown content={feature.telas} />
                  ) : (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Nenhuma página ainda. Clique em “Gerar documento”.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {stage.id === "features" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onFeatureAdd(newFeature);
            setNewFeature("");
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 ring-1 ring-line/60"
        >
          <Plus className="size-3 text-muted-foreground" />
          <input
            value={newFeature}
            onChange={(event) => setNewFeature(event.target.value)}
            placeholder="Adicionar feature"
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
        </form>
      )}
    </div>
  );
}
