import { describe, expect, it } from "vitest";
import { preserveDone, renumberTasks, taskMarkdown, tasksFromAi, type AiTask } from "./tasks";
import type { Feature, Task } from "./types";

const feature = (slug: string, name = slug): Feature => ({
  slug,
  name,
  description: "",
  spec: "",
  telas: "",
  pages: [],
});

const aiTask = (overrides: Partial<AiTask> = {}): AiTask => ({
  title: "Fazer algo",
  kind: "functional",
  dependsOn: [],
  objective: "Objetivo.",
  files: [],
  refs: [],
  actions: [],
  acceptanceCriteria: [],
  howToVerify: "Rodar X e ver Y.",
  outOfScope: "Nada.",
  ...overrides,
});

describe("taskMarkdown", () => {
  it("usa fallback '—' quando files e acceptanceCriteria estão vazios", () => {
    const md = taskMarkdown("T001", "001-agenda", aiTask());
    expect(md).toContain("- —");
    expect(md).toContain("- [ ] ...");
  });

  it("lista os arquivos e critérios informados", () => {
    const md = taskMarkdown(
      "T001",
      "001-agenda",
      aiTask({ files: ["src/a.ts", "src/b.ts"], acceptanceCriteria: ["Critério 1"] }),
    );
    expect(md).toContain("- src/a.ts");
    expect(md).toContain("- src/b.ts");
    expect(md).toContain("- [ ] Critério 1");
  });
});

describe("tasksFromAi", () => {
  it("resolve dependsOn por código já conhecido", () => {
    const existing: Task[] = [
      {
        code: "T001",
        featureSlug: "outra",
        title: "Base",
        kind: "prototype",
        dependsOn: [],
        markdown: "",
        done: false,
      },
    ];
    const [task] = tasksFromAi(
      feature("agenda"),
      "001-agenda",
      [aiTask({ dependsOn: ["T001"] })],
      existing,
    );
    expect(task!.dependsOn).toEqual(["T001"]);
  });

  it("resolve dependsOn por título de outra tarefa na mesma resposta", () => {
    const [proto, func] = tasksFromAi(
      feature("agenda"),
      "001-agenda",
      [
        aiTask({ title: "Tela de agenda", kind: "prototype" }),
        aiTask({ title: "Salvar agendamento", dependsOn: ["Tela de Agenda"] }),
      ],
      [],
    );
    expect(func!.dependsOn).toEqual([proto!.code]);
  });

  it("remove dependsOn não resolvido e auto-referência", () => {
    const [task] = tasksFromAi(
      feature("agenda"),
      "001-agenda",
      [aiTask({ dependsOn: ["não existe"] })],
      [],
    );
    expect(task!.dependsOn).toEqual([]);
  });

  it("normaliza kind diferente de 'prototype' para 'functional'", () => {
    const [task] = tasksFromAi(
      feature("agenda"),
      "001-agenda",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- simulando resposta malformada da IA
      [aiTask({ kind: "qualquer-coisa" as any })],
      [],
    );
    expect(task!.kind).toBe("functional");
  });
});

describe("preserveDone", () => {
  it("mantém done=true quando feature+título não mudam", () => {
    const previous: Task[] = [
      {
        code: "T001",
        featureSlug: "agenda",
        title: "Criar tela",
        kind: "prototype",
        dependsOn: [],
        markdown: "",
        done: true,
      },
    ];
    const next: Task[] = [
      {
        code: "T002",
        featureSlug: "agenda",
        title: "Criar Tela",
        kind: "prototype",
        dependsOn: [],
        markdown: "",
        done: false,
      },
    ];
    expect(preserveDone(next, previous)[0]!.done).toBe(true);
  });

  it("não carrega done quando o título muda", () => {
    const previous: Task[] = [
      {
        code: "T001",
        featureSlug: "agenda",
        title: "Criar tela",
        kind: "prototype",
        dependsOn: [],
        markdown: "",
        done: true,
      },
    ];
    const next: Task[] = [
      {
        code: "T002",
        featureSlug: "agenda",
        title: "Outra tarefa",
        kind: "prototype",
        dependsOn: [],
        markdown: "",
        done: false,
      },
    ];
    expect(preserveDone(next, previous)[0]!.done).toBe(false);
  });
});

describe("renumberTasks", () => {
  const task = (overrides: Partial<Task>): Task => ({
    code: "tmp",
    featureSlug: "agenda",
    title: "Tarefa",
    kind: "functional",
    dependsOn: [],
    markdown: "# tmp — Tarefa\n**Depende de:** —",
    done: false,
    ...overrides,
  });

  it("ordena protótipo antes de funcional", () => {
    const result = renumberTasks(
      [task({ code: "a", kind: "functional" }), task({ code: "b", kind: "prototype" })],
      [feature("agenda")],
    );
    expect(result.map((t) => t.code)).toEqual(["T001", "T002"]);
    expect(result[0]!.kind).toBe("prototype");
  });

  it("dentro do mesmo tipo, respeita a ordem das features", () => {
    const result = renumberTasks(
      [
        task({ code: "a", featureSlug: "financeiro", kind: "prototype" }),
        task({ code: "b", featureSlug: "agenda", kind: "prototype" }),
      ],
      [feature("agenda"), feature("financeiro")],
    );
    expect(result.map((t) => t.featureSlug)).toEqual(["agenda", "financeiro"]);
  });

  it("remapeia dependsOn para os novos códigos e atualiza o markdown", () => {
    const result = renumberTasks(
      [
        task({ code: "a", kind: "prototype" }),
        task({ code: "b", kind: "functional", dependsOn: ["a"] }),
      ],
      [feature("agenda")],
    );
    const functional = result.find((t) => t.kind === "functional")!;
    expect(functional.dependsOn).toEqual(["T001"]);
    expect(functional.markdown).toContain("**Depende de:** T001");
    expect(functional.markdown.startsWith("# T002 —")).toBe(true);
  });

  it("descarta dependsOn que não existe mais entre as tarefas", () => {
    const result = renumberTasks(
      [task({ code: "a", dependsOn: ["não-existe"] })],
      [feature("agenda")],
    );
    expect(result[0]!.dependsOn).toEqual([]);
  });
});
