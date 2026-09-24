import type { Feature, Page } from "./types";

export const newId = () => Math.random().toString(36).slice(2, 10);

const cell = (v: string) => (v || "—").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();

/** Markdown das telas montado a partir das páginas estruturadas. */
export function telasMarkdown(feature: Pick<Feature, "name" | "pages">): string {
  if (!feature.pages.length) return "";
  const out: string[] = [`# Telas — ${feature.name}`, ""];
  feature.pages.forEach((page) => {
    out.push(`## ${page.name}`, `**Rota:** ${page.route || "—"}`, "", `**Objetivo:** ${page.purpose || "—"}`, "");
    page.components.forEach((c) => {
      out.push(`### ${c.name}`);
      if (c.description) out.push(c.description);
      out.push("", "| Ação do usuário | Resultado esperado | Caso de erro |", "| --- | --- | --- |");
      c.behaviors.forEach((b) => out.push(`| ${cell(b.trigger)} | ${cell(b.expectedResult)} | ${cell(b.errorCase)} |`));
      out.push("");
    });
  });
  return out.join("\n").trim() + "\n";
}

export function withPages(feature: Feature, pages: Page[]): Feature {
  return { ...feature, pages, telas: telasMarkdown({ name: feature.name, pages }) };
}

export function pageFileName(page: Page) {
  const base = (page.route && page.route !== "/" ? page.route : page.name) || page.id;
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || (page.route === "/" ? "inicio" : page.id);
}

/** Versão compacta das páginas para prompts. */
export function pagesForPrompt(feature: Feature): string {
  if (!feature.pages.length) return feature.telas || "(sem páginas)";
  return JSON.stringify(
    feature.pages.map((p) => ({
      page: p.name,
      route: p.route,
      purpose: p.purpose,
      components: p.components.map((c) => ({
        name: c.name,
        description: c.description,
        behaviors: c.behaviors,
      })),
    })),
    null,
    1,
  );
}
