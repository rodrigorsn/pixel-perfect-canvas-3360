import { useEffect, useRef } from "react";
import { Upload } from "lucide-react";
import type { Project, Task, VerificationItem } from "@/lib/spec/types";

export function ImplementationPanel({
  tasks,
  onToggle,
  onImport,
}: {
  tasks: Task[];
  onToggle: (code: string, done: boolean) => void;
  onImport: (content: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const done = tasks.filter((t) => t.done).length;

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-panel/60 ring-1 ring-black/5 backdrop-blur-xl">
      <div className="flex h-[42px] flex-none items-center gap-2 border-b border-line/40 px-4">
        <span className="text-[12px] font-semibold">Implementação</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {done}/{tasks.length} concluídas
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-ink-foreground"
        >
          <Upload className="size-3" /> Importar STATUS.md
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".md,text/markdown,text/plain"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onImport(await file.text());
            event.target.value = "";
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!tasks.length && (
          <p className="font-mono text-[11px] text-muted-foreground">
            Gere as tarefas na etapa 6 para acompanhar a implementação.
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {tasks.map((task) => (
            <li key={task.code}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-[12px] ring-1 ring-line/50 hover:bg-ink/5">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={(event) => onToggle(task.code, event.target.checked)}
                  className="mt-0.5 size-3.5 accent-[oklch(0.575_0.114_155)]"
                />
                <span className="flex-1">
                  <span className="font-mono text-[10px] text-accent">{task.code}</span> {task.title}
                  <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{task.featureSlug}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function VerificationPanel({
  project,
  items,
  onToggle,
  onRebuild,
}: {
  project: Project;
  items: VerificationItem[];
  onToggle: (id: string) => void;
  onRebuild: () => void;
}) {
  useEffect(() => {
    if (!items.length && project.tasks.length) onRebuild();
  }, [items.length, project.tasks.length, onRebuild]);

  const done = items.filter((i) => i.done).length;

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-panel/60 ring-1 ring-black/5 backdrop-blur-xl">
      <div className="flex h-[42px] flex-none items-center gap-2 border-b border-line/40 px-4">
        <span className="text-[12px] font-semibold">Verificação</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {done}/{items.length} verificados
        </span>
        <button
          type="button"
          onClick={onRebuild}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-line hover:bg-ink/5"
        >
          Recriar checklist
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!items.length && (
          <p className="font-mono text-[11px] text-muted-foreground">
            O checklist vem dos critérios de aceite das tarefas.
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-[12px] ring-1 ring-line/50 hover:bg-ink/5">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onToggle(item.id)}
                  className="mt-0.5 size-3.5 accent-[oklch(0.575_0.114_155)]"
                />
                <span className="flex-1 text-pretty">{item.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
