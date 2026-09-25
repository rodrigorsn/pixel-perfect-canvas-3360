import type { StageId } from "./types";

export interface StageDef {
  id: StageId;
  num: number;
  title: string;
  short: string;
  docPath: string;
  hasChat: boolean;
  multi: boolean;
  focus: string;
  template: string;
}

export const STAGES: StageDef[] = [
  {
    id: "brainstorm",
    num: 1,
    title: "Brainstorm",
    short: "Ideia, público e escopo",
    docPath: "docs/00-brainstorm.md",
    hasChat: true,
    multi: false,
    focus:
      "Descobrir a ideia, o público-alvo, o problema resolvido, os diferenciais e o que está explicitamente fora do escopo.",
    template: `# Brainstorm

## Ideia
## Público-alvo
## Problema
## Diferenciais
## Fora de escopo`,
  },
  {
    id: "prd",
    num: 2,
    title: "PRD",
    short: "Requisitos do produto",
    docPath: "docs/01-prd.md",
    hasChat: true,
    multi: false,
    focus:
      "Definir objetivos, personas, requisitos funcionais numerados (RF-01...), requisitos não funcionais (RNF-01...), métricas de sucesso e fora de escopo.",
    template: `# PRD

## Objetivos
## Personas
## Requisitos funcionais
- **RF-01** — ...
## Requisitos não funcionais
- **RNF-01** — ...
## Métricas de sucesso
## Fora de escopo`,
  },
  {
    id: "arquitetura",
    num: 3,
    title: "Arquitetura",
    short: "Stack, dados e ADRs",
    docPath: "docs/02-arquitetura.md",
    hasChat: true,
    multi: false,
    focus:
      "Definir stack, estrutura de pastas, modelo de dados (com diagrama mermaid erDiagram), diagrama de classes do domínio (com diagrama mermaid classDiagram), os comandos reais da stack escolhida e decisões registradas como ADRs curtos.",
    template: `# Arquitetura

## Stack
## Estrutura de pastas
## Modelo de dados
\`\`\`mermaid
erDiagram
\`\`\`
## Diagrama de classes
\`\`\`mermaid
classDiagram
\`\`\`
## Comandos
- Instalar: ...
- Rodar: ...
- Testar: ...
- Migrations: ...
- Lint/build: ...
## Decisões (ADRs)`,
  },
  {
    id: "features",
    num: 4,
    title: "Features",
    short: "Specs por feature",
    docPath: "docs/specs",
    hasChat: true,
    multi: true,
    focus:
      "Propor a lista de features a partir do PRD e, para cada uma, escrever a spec com regras de negócio, fluxo principal (mermaid flowchart), fluxos alternativos, casos de borda e os requisitos do PRD atendidos.",
    template: `# NNN-nome — [Feature]

## Regras de negócio
## Fluxo principal
\`\`\`mermaid
flowchart TD
\`\`\`
## Fluxos alternativos
## Casos de borda
## Requisitos atendidos`,
  },
  {
    id: "telas",
    num: 5,
    title: "Telas",
    short: "Telas e wireframes",
    docPath: "docs/specs",
    hasChat: true,
    multi: true,
    focus:
      "Descrever as telas de cada feature: páginas, componentes de cada página e comportamentos (ação do usuário → resultado esperado → caso de erro).",
    template: `# Telas — [Feature]

## Tela: [nome]
### Elementos
### Ação do usuário → Resultado esperado
| Ação | Resultado esperado |
| --- | --- |`,
  },
  {
    id: "tarefas",
    num: 6,
    title: "Tarefas",
    short: "Tarefas executáveis",
    docPath: "docs/tasks",
    hasChat: true,
    multi: true,
    focus:
      "Quebrar cada feature em tarefas pequenas, cada uma executável em uma única sessão de um agente de código.",
    template: `# T001 — [título]
**Feature:** NNN-nome | **Refs:** RF-02, ADR-0001
**Tipo:** Protótipo visual | **Depende de:** T00X, T00Y
## Objetivo
Uma frase.
## Arquivos prováveis (confirmar no /plan)
- caminho/arquivo
## Ação → Resultado esperado
| Ação | Resultado esperado |
| --- | --- |
## Critérios de aceite
- [ ] ...
## Como verificar
Comando do teste automatizado que prova o comportamento (escrito antes da implementação, seguindo TDD). Só use passo manual quando a tarefa for puramente visual/protótipo, sem lógica a testar.
## Fora de escopo
O que NÃO fazer nesta tarefa.
## Plano de implementação
_A ser preenchido pelo comando /plan dentro da IDE._`,
  },
  {
    id: "implementacao",
    num: 7,
    title: "Implementação",
    short: "Acompanhar execução",
    docPath: "STATUS.md",
    hasChat: false,
    multi: false,
    focus: "",
    template: "",
  },
  {
    id: "verificacao",
    num: 8,
    title: "Verificação",
    short: "Checklist final",
    docPath: "docs/verificacao.md",
    hasChat: false,
    multi: false,
    focus: "",
    template: "",
  },
];

export const stageById = (id: StageId) => STAGES.find((s) => s.id === id)!;

/** Marca como "stale" toda etapa já concluída posterior a `fromId` — usado sempre que
 * o conteúdo que ela depende (doc ou features de uma etapa anterior) muda. */
export function markStagesStale<T extends { status: string; stale: boolean }>(
  stages: Record<StageId, T>,
  fromId: StageId,
): Record<StageId, T> {
  const fromNum = stageById(fromId).num;
  const next = { ...stages };
  STAGES.forEach((s) => {
    if (s.num > fromNum && next[s.id].status === "concluida") {
      next[s.id] = { ...next[s.id], stale: true };
    }
  });
  return next;
}
