# Verificação de Coerência entre Documentos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Antes de aprovar PRD, Arquitetura, Features, Telas ou Tarefas, rodar uma checagem de IA que extrai regras por entidade de todo o conteúdo do projeto e aponta contradições, bloqueando a aprovação (com opção de ignorar) até o usuário decidir.

**Architecture:** Novo `kind: "coerencia"` na função de servidor `aiJson` já existente, um novo prompt de sistema (`coherenceReviewSystem`) que reaproveita `approvedContext` e a `ARCHITECT_DOCTRINE`, um novo estado + três funções no hook `useProject`, e um novo modal (`CoherenceModal`) que substitui a aprovação direta.

**Tech Stack:** React 19, TanStack Start (server functions), Zod, DeepSeek via `@ai-sdk/deepseek`, Vitest.

Spec de referência: `docs/superpowers/specs/2026-09-25-coherence-check-design.md`

---

### Task 1: Tipo `CoherenceIssue`

**Files:**
- Modify: `src/lib/spec/types.ts`

- [ ] **Step 1: Adicionar o tipo**

No fim do arquivo `src/lib/spec/types.ts`, depois da interface `Project` (última do arquivo), adicione:

```ts

export interface CoherenceIssue {
  title: string;
  description: string;
  locations: string[];
  suggestion: string;
  severity: "alta" | "media" | "baixa";
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `bunx tsc --noEmit`
Expected: nenhuma saída (sem erros).

- [ ] **Step 3: Commit**

```bash
git add src/lib/spec/types.ts
git commit -m "feat: add CoherenceIssue type"
```

---

### Task 2: Novo `kind: "coerencia"` em `aiJson`

**Files:**
- Modify: `src/lib/ai.functions.ts:29-92`

- [ ] **Step 1: Adicionar o schema**

Em `src/lib/ai.functions.ts`, dentro do objeto `schemas` (começa em `const schemas = {` na linha 29), depois da entrada `wireframe: z.object({ html: z.string() }),` (linha 83) e antes de `} as const;` (linha 84), adicione:

```ts
  coerencia: z.object({
    issues: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        locations: z.array(z.string()),
        suggestion: z.string(),
        severity: z.enum(["alta", "media", "baixa"]),
      }),
    ),
  }),
```

- [ ] **Step 2: Adicionar ao enum de `kind`**

Substitua a linha 89:

```ts
  kind: z.enum(["features", "tasks", "arquitetura", "telas", "wireframe"]),
```

por:

```ts
  kind: z.enum(["features", "tasks", "arquitetura", "telas", "wireframe", "coerencia"]),
```

- [ ] **Step 3: Verificar typecheck e lint**

Run: `bunx tsc --noEmit && bunx eslint src/lib/ai.functions.ts`
Expected: nenhuma saída em ambos (sem erros).

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai.functions.ts
git commit -m "feat: add coerencia kind to aiJson schema"
```

---

### Task 3: `tasksContext` em `prompts.ts` (TDD)

Função pura que monta o bloco de texto com o markdown de todas as tarefas do projeto — só usada pela checagem de coerência na etapa Tarefas, para não inflar o contexto dos outros prompts que já usam `approvedContext`.

**Files:**
- Create: `src/lib/spec/prompts.test.ts`
- Modify: `src/lib/spec/prompts.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/spec/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tasksContext } from "./prompts";
import type { Task } from "./types";

const task = (overrides: Partial<Task> = {}): Task => ({
  code: "T001",
  featureSlug: "agenda",
  title: "Criar tela",
  markdown: "# T001 — Criar tela\n## Objetivo\nUma frase.",
  done: false,
  kind: "prototype",
  dependsOn: [],
  ...overrides,
});

describe("tasksContext", () => {
  it("retorna vazio quando não há tarefas", () => {
    expect(tasksContext({ tasks: [] } as never)).toBe("");
  });

  it("inclui o código, título e markdown de cada tarefa", () => {
    const result = tasksContext({ tasks: [task()] } as never);
    expect(result).toContain("# Tarefas");
    expect(result).toContain("## T001 — Criar tela");
    expect(result).toContain("Uma frase.");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd /c/projetos/spec_studio/spec-studio && bunx vitest run src/lib/spec/prompts.test.ts`
Expected: FAIL — `tasksContext is not a function` (ou erro de import, já que a função ainda não existe em `prompts.ts`).

- [ ] **Step 3: Implementar a função mínima**

Em `src/lib/spec/prompts.ts`, logo antes de `export function interviewSystem(project: Project, stageId: StageId) {` (linha 56), adicione:

```ts
export function tasksContext(project: Project): string {
  if (!project.tasks.length) return "";
  return (
    "\n---\n# Tarefas\n" +
    project.tasks.map((t) => `## ${t.code} — ${t.title}\n${t.markdown}`).join("\n\n")
  );
}

```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `bunx vitest run src/lib/spec/prompts.test.ts`
Expected: PASS — 2 testes passando.

- [ ] **Step 5: Formatar, typecheck, lint**

Run: `bunx prettier --write src/lib/spec/prompts.ts src/lib/spec/prompts.test.ts && bunx tsc --noEmit && bunx eslint src/lib/spec/prompts.ts src/lib/spec/prompts.test.ts`
Expected: prettier reporta os arquivos formatados; `tsc` e `eslint` sem saída.

- [ ] **Step 6: Commit**

```bash
git add src/lib/spec/prompts.ts src/lib/spec/prompts.test.ts
git commit -m "feat: add tasksContext helper (TDD)"
```

---

### Task 4: `coherenceReviewSystem` em `prompts.ts`

Não é testável automaticamente (é texto de prompt para IA — mesma limitação de `interviewSystem`/`docSystem`/`gapReviewSystem`, nenhum dos quais tem teste hoje). Verificação é por typecheck/lint e, no Task 8, pelo fluxo manual completo.

**Files:**
- Modify: `src/lib/spec/prompts.ts`

- [ ] **Step 1: Implementar a função**

Em `src/lib/spec/prompts.ts`, depois de `export function tasksContext(project: Project): string { ... }` (adicionada no Task 3) e antes de `export function interviewSystem`, adicione:

```ts
export function coherenceReviewSystem(project: Project, stageId: StageId) {
  const stage = stageById(stageId);
  const index = STAGES.findIndex((s) => s.id === stageId);
  const next = STAGES[index + 1]!;
  const context =
    approvedContext(project, next.id) + (stageId === "tarefas" ? tasksContext(project) : "");
  return `Você é um arquiteto de software sênior revisando a coerência de TODO o material do projeto até a etapa ${stage.num} — ${stage.title}, incluindo o conteúdo desta etapa.

${ARCHITECT_DOCTRINE}

MODO VERIFICAÇÃO DE COERÊNCIA. Extraia as regras de negócio por entidade-chave do domínio (ex.: status, valor, decisão, prazo) de TODO o conteúdo abaixo, e aponte toda contradição: a mesma entidade com comportamento diferente em dois lugares diferentes.

Regras rígidas:
- Para cada contradição encontrada, preencha um item com: title (resumo curto), description (explica o conflito), locations (onde cada versão da regra aparece, ex.: "PRD — RF-29", "Spec 003 — RN-13"), suggestion (qual regra deveria prevalecer e por quê) e severity ("alta" para contradição que gera comportamento incorreto ou risco de segurança/dado sensível, "media" para inconsistência que confunde mas não quebra, "baixa" para redundância cosmética).
- Se não houver nenhuma contradição, devolva "issues" como lista vazia.
- Não repita a mesma contradição em dois itens.
- Responda sempre em português do Brasil.

Conteúdo completo a analisar:
${context}`;
}

```

- [ ] **Step 2: Verificar typecheck e lint**

Run: `bunx tsc --noEmit && bunx eslint src/lib/spec/prompts.ts`
Expected: nenhuma saída em ambos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spec/prompts.ts
git commit -m "feat: add coherenceReviewSystem prompt"
```

---

### Task 5: `checkAndApprove` e estado do modal em `useProject.ts`

**Files:**
- Modify: `src/lib/spec/useProject.ts:1-17` (imports)
- Modify: `src/lib/spec/useProject.ts:475-489` (`approveStage`)
- Modify: `src/lib/spec/useProject.ts:577-604` (return do hook)

- [ ] **Step 1: Atualizar os imports**

Substitua as linhas 6-12:

```ts
import {
  approvedContext,
  docSystem,
  gapReviewSystem,
  interviewSystem,
  transcript,
} from "./prompts";
```

por:

```ts
import {
  approvedContext,
  coherenceReviewSystem,
  docSystem,
  gapReviewSystem,
  interviewSystem,
  transcript,
} from "./prompts";
```

E substitua a linha 17:

```ts
import type { Feature, Page, Project, StageId, Task } from "./types";
```

por:

```ts
import type { CoherenceIssue, Feature, Page, Project, StageId, Task } from "./types";
```

- [ ] **Step 2: Adicionar o estado do modal**

Logo depois de `const [busy, setBusy] = useState<string | null>(null);` (linha 23), adicione:

```ts
  const [coherenceIssues, setCoherenceIssues] = useState<{
    stageId: StageId;
    issues: CoherenceIssue[];
  } | null>(null);
```

- [ ] **Step 3: Adicionar `checkAndApprove`, `dismissCoherence` e `approveDespiteCoherence`**

Logo depois do fechamento de `approveStage` (depois de `}, []);` na linha 489, antes de `const reopenStage = useCallback(...)`, adicione:

```ts

  const checkAndApprove = useCallback(
    async (id: StageId) => {
      if (stageById(id).num === 1) {
        approveStage(id);
        return;
      }
      setBusy("Verificando coerência…");
      try {
        const res = parseJson(
          await callJson({
            data: {
              kind: "coerencia",
              system: coherenceReviewSystem(project, id),
              prompt: "Verifique a coerência de todo o conteúdo listado no system prompt.",
            },
          }),
        ) as { issues: CoherenceIssue[] };
        if (res.issues.length === 0) {
          approveStage(id);
        } else {
          setCoherenceIssues({ stageId: id, issues: res.issues });
        }
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [project, callJson, approveStage],
  );

  const dismissCoherence = useCallback(() => setCoherenceIssues(null), []);

  const approveDespiteCoherence = useCallback(() => {
    if (coherenceIssues) approveStage(coherenceIssues.stageId);
    setCoherenceIssues(null);
  }, [coherenceIssues, approveStage]);
```

- [ ] **Step 4: Exportar do hook**

No objeto retornado pelo hook (a partir da linha 577, `return { ... }`), depois da linha `approveStage,` (dentro desse objeto), adicione as quatro novas entradas:

```ts
    approveStage,
    checkAndApprove,
    coherenceIssues,
    dismissCoherence,
    approveDespiteCoherence,
```

(Substitua só a linha `approveStage,` existente por esse bloco de 5 linhas — as outras entradas do objeto retornado continuam como estão.)

- [ ] **Step 5: Verificar typecheck e lint**

Run: `bunx prettier --write src/lib/spec/useProject.ts && bunx tsc --noEmit && bunx eslint src/lib/spec/useProject.ts`
Expected: nenhuma saída em `tsc`/`eslint` (prettier reporta o arquivo formatado).

- [ ] **Step 6: Commit**

```bash
git add src/lib/spec/useProject.ts
git commit -m "feat: add checkAndApprove coherence flow to useProject"
```

---

### Task 6: Componente `CoherenceModal`

**Files:**
- Create: `src/components/spec/CoherenceModal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
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
  onCancel,
  onApproveAnyway,
}: {
  issues: CoherenceIssue[] | null;
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
            Contradições encontradas entre os documentos
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
```

- [ ] **Step 2: Verificar typecheck e lint**

Run: `bunx tsc --noEmit && bunx eslint src/components/spec/CoherenceModal.tsx`
Expected: nenhuma saída em ambos.

- [ ] **Step 3: Commit**

```bash
git add src/components/spec/CoherenceModal.tsx
git commit -m "feat: add CoherenceModal component"
```

---

### Task 7: Ligar tudo em `index.tsx` e `DocumentPanel.tsx`

**Files:**
- Modify: `src/routes/index.tsx:10-17` (imports)
- Modify: `src/routes/index.tsx:179-205` (`DocumentPanel` + fim do JSX)
- Modify: `src/components/spec/DocumentPanel.tsx:287-296` (botão "Aprovar etapa")

- [ ] **Step 1: Importar o modal em `index.tsx`**

Substitua a linha 11:

```ts
import { DocumentPanel } from "@/components/spec/DocumentPanel";
```

por:

```ts
import { CoherenceModal } from "@/components/spec/CoherenceModal";
import { DocumentPanel } from "@/components/spec/DocumentPanel";
```

- [ ] **Step 2: Trocar `onApprove` do `DocumentPanel`**

Substitua a linha 185:

```tsx
          onApprove={() => app.approveStage(app.activeStage)}
```

por:

```tsx
          onApprove={() => app.checkAndApprove(app.activeStage)}
```

- [ ] **Step 3: Renderizar o modal**

Substitua o bloco final (linhas 198-206):

```tsx
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
```

por:

```tsx
      <ExportDialog
        project={app.project}
        open={exportOpen}
        onOpenChange={setExportOpen}
        busy={app.busy}
        onGenerateAgents={app.generateAgentsMd}
        onAgentsChange={app.setAgentsMd}
      />

      <CoherenceModal
        issues={app.coherenceIssues?.issues ?? null}
        onCancel={app.dismissCoherence}
        onApproveAnyway={app.approveDespiteCoherence}
      />
    </div>
  );
}
```

- [ ] **Step 4: Desabilitar o botão "Aprovar etapa" durante a checagem**

Em `src/components/spec/DocumentPanel.tsx`, substitua o bloco do botão "Aprovar etapa" (linhas 287-296):

```tsx
            <button
              type="button"
              disabled={!state.doc}
              onClick={props.onApprove}
              className="flex-1 rounded-md bg-green px-3 py-1.5 text-[12px] font-medium text-ink-foreground disabled:opacity-40"
            >
              Aprovar etapa
            </button>
```

por:

```tsx
            <button
              type="button"
              disabled={!state.doc || !!busy}
              onClick={props.onApprove}
              className="flex-1 rounded-md bg-green px-3 py-1.5 text-[12px] font-medium text-ink-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : "Aprovar etapa"}
            </button>
```

- [ ] **Step 5: Verificar typecheck e lint**

Run: `bunx prettier --write src/routes/index.tsx src/components/spec/DocumentPanel.tsx && bunx tsc --noEmit && bunx eslint src/routes/index.tsx src/components/spec/DocumentPanel.tsx`
Expected: nenhuma saída em `tsc`/`eslint`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx src/components/spec/DocumentPanel.tsx
git commit -m "feat: wire coherence check into stage approval flow"
```

---

### Task 8: Verificação final

**Files:** nenhum (só validação)

- [ ] **Step 1: Rodar a suíte inteira**

Run: `bunx vitest run`
Expected: todos os testes passando (os 32 já existentes + os 2 novos de `tasksContext` = 34 no total).

- [ ] **Step 2: Typecheck e lint do projeto inteiro nos arquivos tocados**

Run: `bunx tsc --noEmit && bunx eslint src/lib/spec/types.ts src/lib/ai.functions.ts src/lib/spec/prompts.ts src/lib/spec/prompts.test.ts src/lib/spec/useProject.ts src/components/spec/CoherenceModal.tsx src/routes/index.tsx src/components/spec/DocumentPanel.tsx`
Expected: nenhuma saída em ambos.

- [ ] **Step 3: Reiniciar o dev server e checar o log**

Pare o processo de dev server em execução (se houver) e suba de novo:

Run: `bun dev` (em background)

Depois de alguns segundos, confira o log de saída (ou `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:<porta>/`) e confirme:
- Servidor sobe sem erro de compilação.
- Nenhum `[vite] Failed to reload` ou `ReferenceError` no log.

- [ ] **Step 4: Smoke test manual — caminho sem contradição**

No navegador, abra o projeto, vá numa etapa já com documento gerado (ex.: PRD com Brainstorm aprovado) e clique **"Aprovar etapa"**. Confirme:
- O botão mostra o spinner (`Verificando coerência…` refletido no `busy` global, visível em outros indicadores de carregamento da UI) e fica desabilitado durante a checagem.
- Se não houver contradição, a etapa aprova normalmente (mesmo comportamento de antes desta feature).

- [ ] **Step 5: Smoke test manual — caminho com contradição**

Force uma contradição óbvia: edite manualmente o doc de uma etapa anterior (aba "Editar") pra inserir uma frase que contradiz claramente algo já escrito numa etapa posterior (ex.: mudar uma regra de "sempre X" para "nunca X" onde a etapa posterior já assume "sempre X"). Clique "Aprovar etapa" na etapa posterior e confirme:
- O modal `CoherenceModal` abre, listando a contradição.
- "Cancelar" fecha o modal sem aprovar (o status da etapa continua "andamento").
- Clicar de novo em "Aprovar etapa", e desta vez em "Aprovar mesmo assim" no modal, aprova a etapa (status vira "concluida").

- [ ] **Step 6: Commit final (se houver ajustes do smoke test)**

Se o smoke test não exigir nenhuma correção, não há o que commitar neste passo — os commits já foram feitos nos Tasks 1-7. Se algo precisar de ajuste, corrija, repita a verificação (Steps 1-2) e commit normalmente.
