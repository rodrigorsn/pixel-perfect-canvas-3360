import { STAGES, stageById } from "./stages";
import type { Project, StageId } from "./types";

export function approvedContext(project: Project, upTo: StageId): string {
  const limit = stageById(upTo).num;
  const parts: string[] = [`# Projeto: ${project.name}`];

  for (const stage of STAGES) {
    if (stage.num >= limit) continue;
    const state = project.stages[stage.id];
    if (state.doc.trim()) {
      parts.push(`\n---\n# ${stage.docPath}\n${state.doc.trim()}`);
    }
  }

  if (limit > 3 && project.adrs.length) {
    parts.push(
      "\n---\n# ADRs\n" +
        project.adrs.map((a) => `## ADR-${String(a.number).padStart(4, "0")} — ${a.title}\n${a.content}`).join("\n\n"),
    );
  }

  if (limit > 4 && project.features.length) {
    parts.push(
      "\n---\n# Specs de features\n" +
        project.features.map((f) => `## ${f.slug} — ${f.name}\n${f.spec || f.description}`).join("\n\n"),
    );
  }

  if (limit > 5 && project.features.some((f) => f.telas)) {
    parts.push(
      "\n---\n# Telas\n" + project.features.map((f) => `## ${f.slug}\n${f.telas}`).join("\n\n"),
    );
  }

  return parts.join("\n");
}

export function interviewSystem(project: Project, stageId: StageId) {
  const stage = stageById(stageId);
  return `Você é um arquiteto de software sênior ajudando um desenvolvedor solo a planejar um app. Você está na etapa ${stage.num} — ${stage.title}.

Objetivo desta etapa: ${stage.focus}

MODO ENTREVISTA. Regras rígidas:
- Faça UMA pergunta por vez, objetiva e curta.
- Sempre termine a mensagem com uma linha exatamente no formato: SUGESTÃO: <resposta padrão que o usuário pode aceitar>
- Nunca escreva o documento no chat. A geração é feita pelo botão 'Gerar documento' no painel à direita. Quando tiver informação suficiente, ou quando o usuário pedir para gerar ou avançar, diga 'Pronto para gerar o documento — clique em Gerar documento no painel à direita.' e NÃO inclua a linha SUGESTÃO nessa mensagem.
- Responda sempre em português do Brasil.

Contexto das etapas já aprovadas:
${approvedContext(project, stageId)}`;
}

export function docSystem(project: Project, stageId: StageId) {
  const stage = stageById(stageId);
  return `Você é um arquiteto de software sênior ajudando um desenvolvedor solo a planejar um app. Você está na etapa ${stage.num} — ${stage.title}.

MODO GERAÇÃO. Escreva o documento markdown completo seguindo estritamente este template:

${stage.template}

Regras:
- Responda APENAS com o markdown do documento, sem cercas de código externas e sem comentários.
- Português do Brasil.
- Seja específico e acionável; nada de texto genérico.

Contexto das etapas já aprovadas:
${approvedContext(project, stageId)}`;
}

export function transcript(messages: { role: string; content: string }[]) {
  if (!messages.length) return "Não houve conversa; use o contexto das etapas aprovadas.";
  return messages.map((m) => `${m.role === "user" ? "Usuário" : "Arquiteto"}: ${m.content}`).join("\n\n");
}
