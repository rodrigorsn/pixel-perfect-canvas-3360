import { describe, expect, it } from "vitest";
import { markStagesStale, STAGES } from "./stages";
import type { StageId, StageState } from "./types";

function buildStages(statuses: Partial<Record<StageId, StageState["status"]>>) {
  const stages = {} as Record<StageId, StageState>;
  STAGES.forEach((s) => {
    stages[s.id] = { status: statuses[s.id] ?? "bloqueada", messages: [], doc: "x", stale: false };
  });
  return stages;
}

describe("markStagesStale", () => {
  it("marca como stale apenas as etapas concluídas posteriores à etapa de origem", () => {
    const stages = buildStages({
      prd: "concluida",
      arquitetura: "concluida",
      features: "andamento",
    });
    const result = markStagesStale(stages, "prd");
    expect(result.arquitetura.stale).toBe(true);
    expect(result.features.stale).toBe(false);
  });

  it("não marca a própria etapa de origem nem etapas anteriores", () => {
    const stages = buildStages({ brainstorm: "concluida", prd: "concluida" });
    const result = markStagesStale(stages, "prd");
    expect(result.prd.stale).toBe(false);
    expect(result.brainstorm.stale).toBe(false);
  });

  it("não marca etapas que não estão concluídas, mesmo sendo posteriores", () => {
    const stages = buildStages({ prd: "concluida", arquitetura: "andamento" });
    const result = markStagesStale(stages, "prd");
    expect(result.arquitetura.stale).toBe(false);
  });

  it("não muta o objeto de stages original", () => {
    const stages = buildStages({ prd: "concluida", arquitetura: "concluida" });
    markStagesStale(stages, "prd");
    expect(stages.arquitetura.stale).toBe(false);
  });
});
