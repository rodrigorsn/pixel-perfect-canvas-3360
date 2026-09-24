import { featureFolder } from "./storage";
import type { Project } from "./types";
import { pageFileName } from "./pages";

export function buildFileMap(project: Project): Record<string, string> {
  const files: Record<string, string> = {};

  files["AGENTS.md"] = project.agentsMd.trim() ? project.agentsMd : `# ${project.name} — Constituição do projeto

## Resumo do produto
${section(project.stages.brainstorm.doc, "## Ideia") || project.stages.brainstorm.doc || "Ver docs/00-brainstorm.md"}

## Stack e estrutura de pastas
${section(project.stages.arquitetura.doc, "## Stack") || "Ver docs/02-arquitetura.md"}

${section(project.stages.arquitetura.doc, "## Estrutura de pastas") || ""}

## Regras de código
- Siga a stack e a estrutura de pastas definidas em docs/02-arquitetura.md.
- Respeite as decisões registradas em docs/adr/.
- Não altere arquivos fora do escopo declarado na tarefa.
- Escreva código pequeno e revisável; sem refatorações não pedidas.

## Invariantes
- Todo requisito implementado referencia um RF/RNF do docs/01-prd.md.
- Toda tarefa concluída satisfaz todos os seus critérios de aceite.
- Nenhuma tarefa marca outra tarefa como concluída.

## Comandos
- Instalar: \`npm install\`
- Rodar: \`npm run dev\`
- Testar: \`npm test\`

## Fluxo de trabalho
${WORKFLOW_TEXT}
`;

  files[".claude/commands/plan.md"] = PLAN_CMD;
  files[".claude/commands/execute.md"] = EXECUTE_CMD;
  files["docs/workflow/plan.md"] = toWorkflowDoc(PLAN_CMD);
  files["docs/workflow/execute.md"] = toWorkflowDoc(EXECUTE_CMD);

  files["CLAUDE.md"] = `@AGENTS.md

Siga integralmente as regras de AGENTS.md neste repositório.
`;

  files[".cursor/rules/core.mdc"] = `---
alwaysApply: true
---

Siga integralmente as regras definidas em AGENTS.md na raiz do repositório.
`;

  const currentStage = project.tasks.length ? "Implementação" : "Planejamento";
  files["STATUS.md"] = `# STATUS

**Etapa atual:** ${currentStage}

${statusSection("## Leva 1 — Protótipo visual", project.tasks.filter((t) => t.kind === "prototype"))}

${statusSection("## Leva 2 — Funcional", project.tasks.filter((t) => t.kind !== "prototype"))}
`;

  if (project.stages.brainstorm.doc) files["docs/00-brainstorm.md"] = project.stages.brainstorm.doc;
  if (project.stages.prd.doc) files["docs/01-prd.md"] = project.stages.prd.doc;
  if (project.stages.arquitetura.doc) files["docs/02-arquitetura.md"] = project.stages.arquitetura.doc;

  project.adrs.forEach((adr) => {
    const n = String(adr.number).padStart(4, "0");
    files[`docs/adr/${n}-${adr.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`] =
      `# ADR-${n} — ${adr.title}\n\n${adr.content}\n`;
  });

  project.features.forEach((feature, index) => {
    const folder = featureFolder(index, feature.slug);
    if (feature.spec) files[`docs/specs/${folder}/spec.md`] = feature.spec;
    if (feature.telas) files[`docs/specs/${folder}/telas.md`] = feature.telas;
    const used = new Set<string>();
    feature.pages.forEach((page) => {
      if (!page.wireframe) return;
      let name = pageFileName(page);
      while (used.has(name)) name += "-2";
      used.add(name);
      files[`docs/specs/${folder}/wireframes/${name}.html`] = page.wireframe;
    });

    project.tasks
      .filter((t) => t.featureSlug === feature.slug)
      .forEach((task) => {
        files[`docs/tasks/${folder}/${task.code}.md`] = task.markdown;
      });
  });

  if (project.verification.length) {
    files["docs/verificacao.md"] = `# Verificação\n\n${project.verification
      .map((item) => `- [${item.done ? "x" : " "}] ${item.text}`)
      .join("\n")}\n`;
  }

  return files;
}

function section(doc: string, heading: string) {
  if (!doc) return "";
  const index = doc.indexOf(heading);
  if (index === -1) return "";
  const rest = doc.slice(index);
  const next = rest.indexOf("\n## ", heading.length);
  return next === -1 ? rest.trim() : rest.slice(0, next).trim();
}

export interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

export function buildTree(files: Record<string, string>): TreeNode[] {
  const root: TreeNode[] = [];

  Object.keys(files)
    .sort()
    .forEach((path) => {
      const parts = path.split("/");
      let level = root;
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join("/");
        let node = level.find((n) => n.name === part);
        if (!node) {
          node = { name: part, path: currentPath, ...(isFile ? {} : { children: [] }) };
          level.push(node);
        }
        if (!isFile) level = node.children!;
      });
    });

  return root;
}

export async function downloadZip(project: Project, files: Record<string, string>) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  Object.entries(files).forEach(([path, content]) => zip.file(path, content));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "spec-studio"}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseStatusMd(content: string) {
  const result: Record<string, boolean> = {};
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*-\s*\[([ xX])\]\s*(T\d+)/);
    const mark = match?.[1];
    const code = match?.[2];
    if (mark && code) result[code] = mark.toLowerCase() === "x";
  });
  return result;
}

export function acceptanceCriteria(markdown: string) {
  const start = markdown.indexOf("## Critérios de aceite");
  if (start === -1) return [];
  const rest = markdown.slice(start);
  const end = rest.indexOf("\n## ", 5);
  const block = end === -1 ? rest : rest.slice(0, end);
  return block
    .split("\n")
    .map((line) => line.match(/^\s*-\s*\[[ xX]\]\s*(.+)$/)?.[1]?.trim())
    .filter((v): v is string => Boolean(v));
}

function statusSection(heading: string, tasks: Project["tasks"]) {
  const lines = tasks.length
    ? tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.code} — ${t.title} (${t.featureSlug})`).join("\n")
    : "- [ ] Nenhuma tarefa gerada";
  return `${heading}\n${lines}`;
}

export const WORKFLOW_TEXT = `1. Leia STATUS.md e pegue a próxima tarefa pendente cujas dependências (linha 'Depende de' da tarefa) estejam concluídas.
2. Rode o planejamento da tarefa: /plan T00X no Claude Code, ou siga docs/workflow/plan.md em outras ferramentas.
3. Aguarde a revisão humana do plano.
4. Rode a execução: /execute T00X no Claude Code, ou siga docs/workflow/execute.md.
5. Nunca execute mais de uma tarefa sem autorização.`;

const PLAN_CMD = `---
description: Pesquisa o código e enriquece uma tarefa antes de executá-la
argument-hint: [código da tarefa, ex: T003]
---
Tarefa: $ARGUMENTS
1. Leia AGENTS.md, o arquivo da tarefa em docs/tasks/ e a spec e o telas.md da feature referenciada.
2. Pesquise no código existente: implementações parecidas, componentes, hooks e utilitários que podem ser reutilizados, e os padrões já usados. Não recrie o que já existe.
3. Se a tarefa usar biblioteca ou API externa, consulte a documentação oficial atual antes de planejar.
4. NÃO escreva código. Preencha a seção "## Plano de implementação" do arquivo da tarefa com: arquivos a criar (caminho + conteúdo), arquivos a modificar (caminho + o que muda), o que reutilizar, cenários (caminho feliz, borda, erro), mudanças no banco, dependências novas (com justificativa) e testes a escrever.
5. Mostre o plano e pare para revisão.
`;

const EXECUTE_CMD = `---
description: Executa uma tarefa já planejada
argument-hint: [código da tarefa, ex: T003]
---
Tarefa: $ARGUMENTS
1. Leia AGENTS.md e o arquivo da tarefa. Se a seção "Plano de implementação" ainda estiver com o texto padrão, pare e peça para rodar /plan primeiro.
2. Crie a branch task/$ARGUMENTS.
3. Implemente seguindo estritamente o plano, tocando apenas nos arquivos listados.
4. Escreva e rode os testes do plano e a verificação da seção "Como verificar".
5. Marque a tarefa como concluída em STATUS.md, faça o commit, resuma o que foi feito e pare.
`;

function toWorkflowDoc(cmd: string) {
  return cmd.replace(/^---[\s\S]*?---\n/, "").replaceAll("$ARGUMENTS", "a tarefa indicada");
}
