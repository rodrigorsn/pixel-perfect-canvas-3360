import { featureFolder } from "./storage";
import type { Project } from "./types";
import { pageFileName } from "./pages";

export function buildFileMap(project: Project): Record<string, string> {
  const files: Record<string, string> = {};

  files["AGENTS.md"] = `# ${project.name} — Constituição do projeto

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
1. Leia STATUS.md.
2. Execute a próxima tarefa pendente (docs/tasks/...).
3. Rode a verificação descrita na tarefa.
4. Marque a tarefa como concluída em STATUS.md.
5. Pare e aguarde revisão.
`;

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
