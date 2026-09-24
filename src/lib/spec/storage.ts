import { STAGES } from "./stages";
import type { Project, StageId, StageState } from "./types";

export const STORAGE_KEY = "spec-studio-v1";

export function emptyProject(name = "Novo projeto"): Project {
  const stages = {} as Record<StageId, StageState>;
  STAGES.forEach((stage, index) => {
    stages[stage.id] = {
      status: index === 0 ? "andamento" : "bloqueada",
      messages: [],
      doc: "",
      stale: false,
    };
  });

  return {
    name,
    createdAt: new Date().toISOString(),
    stages,
    adrs: [],
    features: [],
    tasks: [],
    verification: [],
  };
}

export function loadProject(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project;
    if (!parsed?.stages) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProject(project: Project) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function featureFolder(index: number, slug: string) {
  return `${String(index + 1).padStart(3, "0")}-${slug}`;
}
