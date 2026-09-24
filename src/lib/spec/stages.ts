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
      "Definir stack, estrutura de pastas, modelo de dados (com diagrama mermaid erDiagram) e decisões registradas como ADRs curtos.",
    template: `# Arquitetura

## Stack
## Estrutura de pastas
## Modelo de dados
\`\`\`mermaid
erDiagram
\`\`\`
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
      "Descrever as telas de cada feature: elementos da tela e uma tabela 'Ação do usuário → Resultado esperado'.",
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
## Objetivo
Uma frase.
## Arquivos que pode criar/alterar
- caminho/arquivo
## Ação → Resultado esperado
| Ação | Resultado esperado |
| --- | --- |
## Critérios de aceite
- [ ] ...
## Como verificar
Comando ou passo manual que prova que funciona.
## Fora de escopo
O que NÃO fazer nesta tarefa.`,
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
