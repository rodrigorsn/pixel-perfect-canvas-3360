import type { Feature, Task, TaskKind } from "./types";

export interface AiTask {
  title: string;
  kind: TaskKind;
  dependsOn: string[];
  objective: string;
  files: string[];
  refs: string[];
  actions: { action: string; expectedResult: string }[];
  acceptanceCriteria: string[];
  howToVerify: string;
  outOfScope: string;
}

const cell = (v: string) => v.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();

/** Monta o markdown seguindo exatamente o template da etapa Tarefas. */
export function taskMarkdown(code: string, folder: string, t: AiTask): string {
  const list = (items: string[], fallback: string) => (items.length ? items : [fallback]);
  return [
    `# ${code} — ${t.title}`,
    `**Feature:** ${folder} | **Refs:** ${t.refs.length ? t.refs.join(", ") : "—"}`,
    `## Objetivo`,
    t.objective.trim(),
    `## Arquivos que pode criar/alterar`,
    ...list(t.files, "—").map((f) => `- ${f}`),
    `## Ação → Resultado esperado`,
    `| Ação | Resultado esperado |`,
    `| --- | --- |`,
    ...t.actions.map((a) => `| ${cell(a.action)} | ${cell(a.expectedResult)} |`),
    `## Critérios de aceite`,
    ...list(t.acceptanceCriteria, "...").map((c) => `- [ ] ${c}`),
    `## Como verificar`,
    t.howToVerify.trim(),
    `## Fora de escopo`,
    t.outOfScope.trim(),
    "",
  ].join("\n");
}

/** Converte a resposta da IA para uma feature em tarefas com códigos temporários. */
export function tasksFromAi(
  feature: Feature,
  folder: string,
  items: AiTask[],
  existing: Task[],
): Task[] {
  const tmp = items.map((_, i) => `tmp-${feature.slug}-${i}`);
  const byTitle = new Map(items.map((t, i) => [t.title.trim().toLowerCase(), tmp[i]!]));
  const knownCodes = new Set(existing.map((t) => t.code));
  return items.map((t, i) => ({
    code: tmp[i]!,
    featureSlug: feature.slug,
    title: t.title,
    kind: t.kind === "prototype" ? "prototype" : "functional",
    dependsOn: t.dependsOn
      .map((d) => {
        const key = d.trim();
        if (knownCodes.has(key)) return key;
        return byTitle.get(key.toLowerCase()) ?? null;
      })
      .filter((d): d is string => !!d && d !== tmp[i]),
    markdown: taskMarkdown(tmp[i]!, folder, t),
    done: false,
  }));
}

/** Mantém o "done" das tarefas cujo título (na mesma feature) não mudou. */
export function preserveDone(next: Task[], previous: Task[]): Task[] {
  const key = (t: Task) => `${t.featureSlug}::${t.title.trim().toLowerCase()}`;
  const done = new Map(previous.map((t) => [key(t), t.done]));
  return next.map((t) => ({ ...t, done: done.get(key(t)) ?? t.done }));
}

/** Renumera: primeiro protótipo, depois funcional; dentro de cada grupo pela ordem das features. */
export function renumberTasks(tasks: Task[], features: Feature[]): Task[] {
  const order = new Map(features.map((f, i) => [f.slug, i]));
  const indexed = tasks.map((t, i) => ({ t, i }));
  indexed.sort((a, b) => {
    const ka = a.t.kind === "prototype" ? 0 : 1;
    const kb = b.t.kind === "prototype" ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const fa = order.get(a.t.featureSlug) ?? 9999;
    const fb = order.get(b.t.featureSlug) ?? 9999;
    if (fa !== fb) return fa - fb;
    return a.i - b.i;
  });
  const map = new Map<string, string>();
  indexed.forEach(({ t }, i) => map.set(t.code, `T${String(i + 1).padStart(3, "0")}`));
  return indexed.map(({ t }) => {
    const code = map.get(t.code)!;
    return {
      ...t,
      code,
      dependsOn: t.dependsOn.map((d) => map.get(d)).filter((d): d is string => !!d),
      markdown: t.markdown.replace(/^#\s*\S+\s*—/, `# ${code} —`),
    };
  });
}
