import { describe, expect, it } from "vitest";
import { pageFileName, pagesForPrompt, telasMarkdown, withPages } from "./pages";
import type { Feature, Page } from "./types";

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "p1",
  name: "Lista de agendamentos",
  route: "/agenda",
  purpose: "Ver os agendamentos do dia.",
  components: [],
  wireframe: "",
  ...overrides,
});

describe("telasMarkdown", () => {
  it("retorna vazio quando não há páginas", () => {
    expect(telasMarkdown({ name: "Agenda", pages: [] })).toBe("");
  });

  it("monta a tabela de comportamentos por componente", () => {
    const md = telasMarkdown({
      name: "Agenda",
      pages: [
        page({
          components: [
            {
              id: "c1",
              name: "Botão salvar",
              description: "Salva o agendamento",
              behaviors: [
                {
                  trigger: "Clicar em salvar",
                  expectedResult: "Agendamento criado",
                  errorCase: "Mostra erro",
                },
              ],
            },
          ],
        }),
      ],
    });
    expect(md).toContain("# Telas — Agenda");
    expect(md).toContain("## Lista de agendamentos");
    expect(md).toContain("### Botão salvar");
    expect(md).toContain("| Clicar em salvar | Agendamento criado | Mostra erro |");
  });

  it("escapa pipes e quebras de linha nas células", () => {
    const md = telasMarkdown({
      name: "Agenda",
      pages: [
        page({
          components: [
            {
              id: "c1",
              name: "Campo",
              description: "",
              behaviors: [{ trigger: "a | b\nc", expectedResult: "—", errorCase: "—" }],
            },
          ],
        }),
      ],
    });
    expect(md).toContain("a \\| b c");
  });
});

describe("withPages", () => {
  it("recalcula o markdown de telas a partir das páginas", () => {
    const feature: Feature = {
      slug: "agenda",
      name: "Agenda",
      description: "",
      spec: "",
      telas: "",
      pages: [],
    };
    const result = withPages(feature, [page()]);
    expect(result.pages).toHaveLength(1);
    expect(result.telas).toContain("# Telas — Agenda");
  });
});

describe("pageFileName", () => {
  it("usa a rota quando existe e não é raiz", () => {
    expect(pageFileName(page({ route: "/agenda/nova" }))).toBe("agenda-nova");
  });

  it("usa o nome da página quando a rota é raiz", () => {
    expect(pageFileName(page({ route: "/", name: "Início" }))).toBe("inicio");
  });

  it("cai para o nome da página quando não há rota", () => {
    expect(pageFileName(page({ route: "", name: "Configurações" }))).toBe("configuracoes");
  });
});

describe("pagesForPrompt", () => {
  it("retorna '(sem páginas)' quando a feature não tem páginas nem telas", () => {
    const feature: Feature = {
      slug: "agenda",
      name: "Agenda",
      description: "",
      spec: "",
      telas: "",
      pages: [],
    };
    expect(pagesForPrompt(feature)).toBe("(sem páginas)");
  });

  it("serializa as páginas em JSON compacto", () => {
    const feature: Feature = {
      slug: "agenda",
      name: "Agenda",
      description: "",
      spec: "",
      telas: "",
      pages: [page()],
    };
    const json = JSON.parse(pagesForPrompt(feature));
    expect(json).toEqual([
      {
        page: "Lista de agendamentos",
        route: "/agenda",
        purpose: "Ver os agendamentos do dia.",
        components: [],
      },
    ]);
  });
});
