import { describe, expect, it } from "vitest";
import { acceptanceCriteria, buildFileMap, parseStatusMd } from "./export";
import { emptyProject } from "./storage";

describe("parseStatusMd", () => {
  it("lê tarefas marcadas e não marcadas", () => {
    const content = `# STATUS
## Leva 1
- [x] T001 — Criar tela (agenda)
- [ ] T002 — Salvar agendamento (agenda)
`;
    expect(parseStatusMd(content)).toEqual({ T001: true, T002: false });
  });

  it("aceita 'X' maiúsculo e ignora linhas sem checkbox", () => {
    const content = `- [X] T003 — Algo
Texto qualquer sem checkbox
- [ ] T004 — Outra coisa`;
    expect(parseStatusMd(content)).toEqual({ T003: true, T004: false });
  });

  it("retorna objeto vazio quando não há tarefas", () => {
    expect(parseStatusMd("# STATUS\nNada aqui.")).toEqual({});
  });
});

describe("buildFileMap — slug de ADR", () => {
  it("mantém as letras acentuadas ao virar slug, sem perdê-las pro traço", () => {
    const project = emptyProject("Teste");
    project.adrs = [{ number: 1, title: "Monólito Next.js em Container Único", content: "..." }];
    const files = buildFileMap(project);
    expect(Object.keys(files)).toContain("docs/adr/0001-monolito-next-js-em-container-unico.md");
  });
});

describe("acceptanceCriteria", () => {
  it("extrai os itens da seção 'Critérios de aceite'", () => {
    const markdown = `# T001 — Título
## Objetivo
Uma frase.
## Critérios de aceite
- [ ] Primeiro critério
- [x] Segundo critério
## Como verificar
Rodar X.`;
    expect(acceptanceCriteria(markdown)).toEqual(["Primeiro critério", "Segundo critério"]);
  });

  it("retorna lista vazia quando a seção não existe", () => {
    expect(acceptanceCriteria("# T001 — Título\nSem seção de critérios.")).toEqual([]);
  });

  it("para no próximo heading de segundo nível", () => {
    const markdown = `## Critérios de aceite
- [ ] Único critério
## Como verificar
- [ ] Isso não é critério`;
    expect(acceptanceCriteria(markdown)).toEqual(["Único critério"]);
  });
});
