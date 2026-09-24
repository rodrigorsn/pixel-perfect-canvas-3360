import { useMemo, useState } from "react";
import { Download, FileText, Folder, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildFileMap, buildTree, downloadZip, type TreeNode } from "@/lib/spec/export";
import type { Project } from "@/lib/spec/types";
import { cn } from "@/lib/utils";

export function ExportDialog({
  project,
  open,
  onOpenChange,
  busy,
  onGenerateAgents,
  onAgentsChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: string | null;
  onGenerateAgents: () => void;
  onAgentsChange: (value: string) => void;
}) {
  const files = useMemo(() => buildFileMap(project), [project]);
  const tree = useMemo(() => buildTree(files), [files]);
  const [selected, setSelected] = useState<string>("AGENTS.md");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[920px] gap-0 bg-panel p-0">
        <DialogHeader className="border-b border-line/40 px-5 py-3">
          <DialogTitle className="font-display text-[14px]">Pacote para agentes de código</DialogTitle>
        </DialogHeader>

        <div className="flex h-[520px] min-h-0">
          <div className="w-[280px] flex-none overflow-y-auto border-r border-line/40 p-3">
            <TreeView nodes={tree} selected={selected} onSelect={setSelected} depth={0} />
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{selected}</p>
            {selected === "AGENTS.md" ? (
              <textarea
                value={files["AGENTS.md"] ?? ""}
                onChange={(event) => onAgentsChange(event.target.value)}
                spellCheck={false}
                className="h-[440px] w-full resize-none rounded-md bg-panel/70 p-3 font-mono text-[11px] leading-relaxed outline-none ring-1 ring-line/60 focus:ring-accent"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
                {files[selected] ?? "Selecione um arquivo."}
              </pre>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line/40 px-5 py-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            {Object.keys(files).length} arquivos
          </span>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              setSelected("AGENTS.md");
              onGenerateAgents();
            }}
            className="ml-auto flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-line hover:bg-ink/5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Gerar AGENTS.md com IA
          </button>
          <button
            type="button"
            onClick={() => downloadZip(project, files)}
            className="flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-ink-foreground"
          >
            <Download className="size-3.5" /> Baixar .zip
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TreeView({
  nodes,
  selected,
  onSelect,
  depth,
}: {
  nodes: TreeNode[];
  selected: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.path}>
          {node.children ? (
            <>
              <div
                className="flex items-center gap-1.5 py-1 font-mono text-[11px] text-muted-foreground"
                style={{ paddingLeft: depth * 12 }}
              >
                <Folder className="size-3" /> {node.name}
              </div>
              <TreeView nodes={node.children} selected={selected} onSelect={onSelect} depth={depth + 1} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSelect(node.path)}
              style={{ paddingLeft: depth * 12 }}
              className={cn(
                "flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left font-mono text-[11px]",
                selected === node.path ? "bg-ink/8 text-foreground" : "text-foreground/80 hover:bg-ink/5",
              )}
            >
              <FileText className="size-3 flex-none text-accent" /> {node.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
