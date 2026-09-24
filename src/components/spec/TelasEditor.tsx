import { useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import type { Behavior, Component, Feature, Page } from "@/lib/spec/types";
import { newId } from "@/lib/spec/pages";

interface Props {
  feature: Feature;
  busy: string | null;
  onChange: (pages: Page[]) => void;
  onGenerateWireframe: (pageId: string) => void;
}

const input =
  "w-full rounded-md bg-panel/70 px-2 py-1 text-[12px] outline-none ring-1 ring-line/60 focus:ring-accent";
const iconBtn = "rounded p-1 text-muted-foreground hover:bg-ink/5";
const smallBtn =
  "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-line hover:bg-ink/5 disabled:opacity-50";

export function TelasEditor({ feature, busy, onChange, onGenerateWireframe }: Props) {
  const [pageId, setPageId] = useState<string | null>(null);
  const page = feature.pages.find((p) => p.id === pageId);

  const setPage = (patch: Partial<Page>) =>
    onChange(feature.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)));

  if (!page) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-balance font-display text-[16px] font-semibold tracking-tight">Telas — {feature.name}</div>
        {!feature.pages.length && (
          <p className="font-mono text-[11px] text-muted-foreground">Nenhuma página ainda. Clique em “Gerar documento”.</p>
        )}
        <ul className="flex flex-col gap-1">
          {feature.pages.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-md ring-1 ring-line/50">
              <button
                type="button"
                onClick={() => setPageId(p.id)}
                className="flex-1 rounded-md px-2 py-2 text-left text-[12px] hover:bg-ink/5"
              >
                <span className="font-mono text-[10px] text-accent">{p.route || "—"}</span>
                <span className="block">{p.name}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {p.components.length} componentes{p.wireframe ? " · wireframe" : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onChange(feature.pages.filter((x) => x.id !== p.id))}
                className={`${iconBtn} mr-1`}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${smallBtn} self-start`}
          onClick={() => {
            const id = newId();
            onChange([...feature.pages, { id, name: "Nova página", route: "/", purpose: "", components: [], wireframe: "" }]);
            setPageId(id);
          }}
        >
          <Plus className="size-3" /> Página
        </button>
      </div>
    );
  }

  const setComponent = (id: string, patch: Partial<Component>) =>
    setPage({ components: page.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const setBehavior = (c: Component, index: number, patch: Partial<Behavior>) =>
    setComponent(c.id, { behaviors: c.behaviors.map((b, i) => (i === index ? { ...b, ...patch } : b)) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setPageId(null)} className={iconBtn}>
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">{feature.name}</span>
      </div>
      <input className={`${input} font-display text-[14px] font-semibold`} value={page.name} onChange={(e) => setPage({ name: e.target.value })} placeholder="Nome da página" />
      <input className={`${input} font-mono`} value={page.route} onChange={(e) => setPage({ route: e.target.value })} placeholder="/rota" />
      <textarea className={`${input} min-h-[48px] resize-y`} value={page.purpose} onChange={(e) => setPage({ purpose: e.target.value })} placeholder="Objetivo da página" />

      {page.components.map((c) => (
        <div key={c.id} className="flex flex-col gap-1.5 rounded-md p-2 ring-1 ring-line/50">
          <div className="flex items-center gap-1">
            <input className={`${input} font-medium`} value={c.name} onChange={(e) => setComponent(c.id, { name: e.target.value })} placeholder="Componente" />
            <button type="button" className={iconBtn} onClick={() => setPage({ components: page.components.filter((x) => x.id !== c.id) })}>
              <Trash2 className="size-3" />
            </button>
          </div>
          <input className={input} value={c.description} onChange={(e) => setComponent(c.id, { description: e.target.value })} placeholder="Descrição" />
          {c.behaviors.map((b, i) => (
            <div key={i} className="flex items-start gap-1 border-l-2 border-accent/40 pl-2">
              <div className="flex flex-1 flex-col gap-1">
                <input className={input} value={b.trigger} onChange={(e) => setBehavior(c, i, { trigger: e.target.value })} placeholder="Ação do usuário" />
                <input className={input} value={b.expectedResult} onChange={(e) => setBehavior(c, i, { expectedResult: e.target.value })} placeholder="Resultado esperado" />
                <input className={input} value={b.errorCase} onChange={(e) => setBehavior(c, i, { errorCase: e.target.value })} placeholder="Caso de erro" />
              </div>
              <button type="button" className={iconBtn} onClick={() => setComponent(c.id, { behaviors: c.behaviors.filter((_, j) => j !== i) })}>
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`${smallBtn} self-start`}
            onClick={() => setComponent(c.id, { behaviors: [...c.behaviors, { trigger: "", expectedResult: "", errorCase: "" }] })}
          >
            <Plus className="size-3" /> Comportamento
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${smallBtn} self-start`}
        onClick={() => setPage({ components: [...page.components, { id: newId(), name: "", description: "", behaviors: [] }] })}
      >
        <Plus className="size-3" /> Componente
      </button>

      <div className="mt-1">
        <div className="mb-1 flex items-center">
          <p className="flex-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Wireframe</p>
          <button type="button" disabled={!!busy} className={smallBtn} onClick={() => onGenerateWireframe(page.id)}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            Gerar wireframe
          </button>
        </div>
        {page.wireframe && (
          <iframe
            title="Wireframe"
            sandbox=""
            srcDoc={page.wireframe}
            className="h-[420px] w-full rounded-md bg-panel ring-1 ring-line/60"
          />
        )}
      </div>
    </div>
  );
}
