import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { StageDef } from "@/lib/spec/stages";
import type { StageState } from "@/lib/spec/types";
import { cn } from "@/lib/utils";

interface Props {
  stage: StageDef;
  state: StageState;
  busy: string | null;
  onSend: (text: string) => void;
  onGenerate: () => void;
}

function splitSuggestion(content: string) {
  const match = content.match(/SUGEST(?:Ã|A)O:\s*(.+)\s*$/i);
  const hint = match?.[1];
  if (!match || !hint) return { body: content, suggestion: null as string | null };
  return { body: content.slice(0, match.index).trim(), suggestion: hint.trim() };
}

const READY_RE = /pronto para gerar o documento/i;
const GENERATE_INTENT_RE =
  /^(?:ok[,!.\s]*)?(?:pode\s+)?(?:gerar|gera|gere|seguir|segue|siga|avan[çc]ar|avan[çc]a|avance|prosseguir)(?:\s+(?:o\s+)?(?:documento|doc))?(?:\s+agora)?[\s.!]*$|^gerar\s+documento/i;

export function ChatPanel({ stage, state, busy, onSend, onGenerate }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length, busy]);

  const last = state.messages[state.messages.length - 1];
  const suggestion = last?.role === "assistant" ? splitSuggestion(last.content).suggestion : null;
  const ready = last?.role === "assistant" && READY_RE.test(last.content);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    setDraft("");
    if (GENERATE_INTENT_RE.test(value.normalize("NFC"))) {
      onGenerate();
      return;
    }
    onSend(value);
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-panel/60 ring-1 ring-black/5 backdrop-blur-xl">
      <div className="flex h-[42px] flex-none items-center gap-2 border-b border-line/40 px-4">
        <span className="text-[12px] font-semibold">Arquiteto de IA</span>
        <span className="size-1.5 rounded-full bg-green" />
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          etapa {stage.num} · {stage.title.toLowerCase()}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {state.messages.length === 0 && (
          <div className="rounded-[9px] bg-panel/50 px-3 py-2 text-[13px] leading-relaxed ring-1 ring-black/5">
            <span className="mb-1 block font-mono text-[10px] text-muted-foreground">arquiteto</span>
            Conte o que você quer construir. Vou fazer uma pergunta por vez para fechar a etapa “{stage.title}”.
          </div>
        )}

        {state.messages.map((message, index) => {
          const { body, suggestion: hint } = splitSuggestion(message.content);
          return (
            <div
              key={index}
              className={cn(
                "animate-fade-up whitespace-pre-wrap rounded-[9px] px-3 py-2 text-[13px] leading-relaxed text-pretty ring-1 ring-black/5",
                message.role === "user"
                  ? "max-w-[86%] self-end rounded-tr-sm bg-ink/8"
                  : "max-w-[90%] rounded-tl-sm bg-panel/50",
              )}
            >
              <span className="mb-1 block font-mono text-[10px] text-muted-foreground">
                {message.role === "user" ? "você" : "arquiteto"}
              </span>
              {body}
              {hint && (
                <span className="mt-2 block font-mono text-[11px] text-accent">sugestão: {hint}</span>
              )}
            </div>
          );
        })}

        {ready && !busy && (
          <button
            type="button"
            onClick={onGenerate}
            className="self-start rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground"
          >
            Gerar documento agora
          </button>
        )}

        {busy && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> {busy}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-none flex-col gap-2 border-t border-line/40 p-3">
        {suggestion && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => send(suggestion)}
              className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-ink-foreground disabled:opacity-50"
            >
              Aceitar sugestão
            </button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2 rounded-md bg-panel/40 px-3 py-2 ring-1 ring-line"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva para o arquiteto…"
            disabled={!!busy}
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
          <span className="font-mono text-[10px] text-muted-foreground">⏎ enviar</span>
        </form>
      </div>
    </section>
  );
}
