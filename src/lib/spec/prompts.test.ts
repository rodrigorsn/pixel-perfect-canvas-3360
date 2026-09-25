import { describe, expect, it } from "vitest";
import { tasksContext } from "./prompts";
import type { Task } from "./types";

const task = (overrides: Partial<Task> = {}): Task => ({
  code: "T001",
  featureSlug: "agenda",
  title: "Criar tela",
  markdown: "# T001 — Criar tela\n## Objetivo\nUma frase.",
  done: false,
  kind: "prototype",
  dependsOn: [],
  ...overrides,
});

describe("tasksContext", () => {
  it("retorna vazio quando não há tarefas", () => {
    expect(tasksContext({ tasks: [] } as never)).toBe("");
  });

  it("inclui o código, título e markdown de cada tarefa", () => {
    const result = tasksContext({ tasks: [task()] } as never);
    expect(result).toContain("# Tarefas");
    expect(result).toContain("## T001 — Criar tela");
    expect(result).toContain("Uma frase.");
  });
});
