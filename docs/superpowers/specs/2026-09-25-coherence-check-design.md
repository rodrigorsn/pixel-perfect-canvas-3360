# Verificação de coerência entre documentos — design

## Contexto e motivação

Duas revisões externas independentes do pacote gerado pelo Spec Studio (PRD, Arquitetura, ADRs, specs de features, telas e tarefas de um projeto real) encontraram o mesmo padrão de problema: **contradições de regra de negócio espalhadas entre documentos diferentes**, porque cada documento é gerado isoladamente e nenhuma etapa confere o conjunto contra si mesmo.

Exemplos reais encontrados nas revisões:
- PRD diz que falta/cancelamento "nasce como não cobrável"; uma spec de feature grava `decisao_cobranca = 'nao_cobrar'` automaticamente; outra spec diz que fica `NULL`, aguardando decisão manual — três regras diferentes pra mesma entidade.
- PRD diz que "toda escrita é bloqueada" quando offline; ADR e tarefas subsequentes implementam uma fila de escrita local cifrada — dois modelos de offline coexistindo sem nunca terem sido conciliados.
- Efeito financeiro de troca de status implementado em duas features diferentes (Agenda e Financeiro), sem dono único.

O objetivo desta feature é adicionar uma etapa de verificação automática que pega esse tipo de contradição **antes** de aprovar uma etapa, evitando que ela vire código.

## Fluxo

Ao clicar em **"Aprovar etapa"** em qualquer etapa com `hasChat: true` e `num > 1` (PRD, Arquitetura, Features, Telas, Tarefas — Brainstorm fica de fora por não ter nada anterior para contradizer):

1. Em vez de aprovar direto, dispara uma chamada de IA que junta todo o conteúdo relevante até ali (documentos aprovados + o conteúdo da própria etapa sendo aprovada, incluindo as tarefas geradas quando a etapa é Tarefas) e pede para extrair regras por entidade-chave do domínio e apontar contradições.
2. Se não encontrar nada: aprova normalmente (só o "Aprovando…" no botão como feedback).
3. Se encontrar: abre um modal com checklist das contradições. Duas ações: **Cancelar** (fecha, o usuário edita os documentos e tenta aprovar de novo) ou **Aprovar mesmo assim** (ignora e aprova imediatamente).
4. Nenhum estado de "contradição aceita" é persistido entre tentativas — cada clique em "Aprovar etapa" roda a checagem do zero. Aprovar é uma ação pontual, não recorrente, então o custo extra de IA por checagem é aceitável e a simplicidade de não rastrear identidade de issues entre execuções vale mais.

## Dados e prompt

Novo `kind: "coerencia"` em `ai.functions.ts`, com schema:

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
})
```

Novo `coherenceReviewSystem(project, stageId)` em `prompts.ts`, reaproveitando a `ARCHITECT_DOCTRINE` já existente. Instrui: extrair as regras por entidade-chave do domínio (status, valor, decisão, prazo, etc.) de todo o conteúdo fornecido, e apontar toda contradição — a mesma entidade com comportamento diferente em dois lugares.

**Contexto enviado**: reaproveita `approvedContext(project, upTo)` sem alterá-la, passando a etapa **seguinte** à que está sendo aprovada como `upTo` (para incluir o conteúdo da própria etapa). `approvedContext` é usada por `interviewSystem`, `docSystem` e `gapReviewSystem` também — não deve ganhar o markdown das tarefas, senão infla o contexto (e o custo) desses outros prompts sem necessidade. Em vez disso, um helper novo e específico, `tasksContext(project)`, monta só o bloco de tarefas; `coherenceReviewSystem` concatena `approvedContext(...)` com `tasksContext(project)` apenas quando `stageId === "tarefas"`.

## Interface

Novo componente `components/spec/CoherenceModal.tsx`, seguindo o padrão visual de `ExportDialog.tsx` (primitivos `Dialog` já existentes em `components/ui/dialog`). Lista os `issues` ordenados por severidade (alta primeiro), cada um com título, descrição, `locations` e `suggestion`. Rodapé com "Cancelar" e "Aprovar mesmo assim".

No hook (`useProject.ts`), nova função substitui o uso direto de `approveStage` pelo botão:

```ts
checkAndApprove(stageId) {
  if (stageById(stageId).num === 1) { approveStage(stageId); return; }
  setBusy("Verificando coerência…");
  try {
    const { issues } = await callJson({ kind: "coerencia", system: coherenceReviewSystem(project, stageId), ... });
    if (issues.length === 0) approveStage(stageId);
    else setCoherenceIssues({ stageId, issues }); // abre o modal
  } catch (error) {
    toast.error(errorMessage(error)); // não aprova em caso de erro
  } finally {
    setBusy(null);
  }
}
```

Dois novos estados/ações expostos pelo hook: `coherenceIssues` (o que o modal renderiza) e `dismissCoherence()` / `approveDespiteCoherence()`.

Em `routes/index.tsx`: troca `onApprove={() => app.approveStage(app.activeStage)}` por `onApprove={() => app.checkAndApprove(app.activeStage)}`, e renderiza `<CoherenceModal>` ao lado do `<ExportDialog>` já existente.

## Testes e tratamento de erro

**Testável (TDD, Vitest):** `tasksContext(project)` — lógica pura, fixtures, mesmo padrão usado em `markStagesStale`.

**Não testável automaticamente:** o prompt em si e a qualidade da resposta da IA — mesma limitação que já existe em todo o restante do app (nenhuma chamada de IA tem teste automatizado hoje).

**Erro na chamada de IA** (rate limit, rede): mostra `toast.error`, não aprova a etapa. Mesmo padrão usado em todo o resto do app — erro interrompe a ação, o usuário tenta de novo. Não existe fail-open que aprove silenciosamente se a checagem falhar.

## Arquivos afetados

- `src/lib/ai.functions.ts` — novo `kind: "coerencia"` no schema de `aiJson`.
- `src/lib/spec/prompts.ts` — novo `coherenceReviewSystem` e novo helper `tasksContext` (não altera `approvedContext`).
- `src/lib/spec/useProject.ts` — novo `checkAndApprove`, estado e ações do modal.
- `src/components/spec/CoherenceModal.tsx` — novo.
- `src/routes/index.tsx` — troca o `onApprove` do `DocumentPanel` e renderiza o modal.

## Fora de escopo (decidido durante o brainstorm)

- Persistir/rastrear identidade de issues entre execuções da checagem (aceitar risco não "gruda" entre tentativas).
- Rodar a checagem em outro momento além do clique em "Aprovar etapa" (nada automático em background, nada no botão "Gerar documento"/"Regerar").
- Bloquear com severidade mínima configurável — todo issue encontrado abre o modal, a triagem por severidade é só visual/ordenação.
- Testes de componente para o `CoherenceModal` (o projeto não tem infraestrutura de teste de componente React hoje; fora de escopo abrir essa frente aqui).
