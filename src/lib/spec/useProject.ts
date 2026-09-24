import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { aiJson, aiText } from "../ai.functions";
import { STAGES, stageById } from "./stages";
import { docSystem, interviewSystem, transcript } from "./prompts";
import { emptyProject, loadProject, saveProject, slugify } from "./storage";
import { acceptanceCriteria, parseStatusMd } from "./export";
import type { Feature, Project, StageId, Task } from "./types";

export function useProject() {
  const [project, setProject] = useState<Project>(() => emptyProject());
  const [hydrated, setHydrated] = useState(false);
  const [activeStage, setActiveStage] = useState<StageId>("brainstorm");
  const [busy, setBusy] = useState<string | null>(null);

  const callText = useServerFn(aiText);
  const callJson = useServerFn(aiJson);

  useEffect(() => {
    const stored = loadProject();
    if (stored) {
      setProject(stored);
      const current = STAGES.find((s) => stored.stages[s.id].status === "andamento");
      if (current) setActiveStage(current.id);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveProject(project);
  }, [project, hydrated]);

  const progress = useMemo(() => {
    const done = STAGES.filter((s) => project.stages[s.id].status === "concluida").length;
    return Math.round((done / STAGES.length) * 100);
  }, [project]);

  const resetProject = useCallback((name: string) => {
    setProject(emptyProject(name || "Novo projeto"));
    setActiveStage("brainstorm");
  }, []);

  const renameProject = useCallback((name: string) => {
    setProject((p) => ({ ...p, name }));
  }, []);

  const patchStage = useCallback((id: StageId, patch: Partial<Project["stages"][StageId]>) => {
    setProject((p) => ({ ...p, stages: { ...p.stages, [id]: { ...p.stages[id], ...patch } } }));
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const stageId = activeStage;
      const base = project.stages[stageId];
      const messages = [...base.messages, { role: "user" as const, content: text }];
      patchStage(stageId, { messages });
      setBusy("Pensando…");
      try {
        const res = await callText({
          data: { system: interviewSystem(project, stageId), messages },
        });
        setProject((p) => ({
          ...p,
          stages: {
            ...p.stages,
            [stageId]: {
              ...p.stages[stageId],
              messages: [...messages, { role: "assistant", content: res.text }],
            },
          },
        }));
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [activeStage, project, callText, patchStage],
  );

  const generateDoc = useCallback(async () => {
    const stageId = activeStage;
    const stage = stageById(stageId);
    const state = project.stages[stageId];
    setBusy("Gerando documento…");

    try {
      if (stageId === "brainstorm" || stageId === "prd") {
        const res = await callText({
          data: {
            system: docSystem(project, stageId),
            messages: [{ role: "user", content: `Conversa da etapa:\n\n${transcript(state.messages)}` }],
          },
        });
        patchStage(stageId, { doc: res.text, stale: false });
      } else if (stageId === "arquitetura") {
        const res = (await callJson({
          data: {
            kind: "arquitetura",
            system: docSystem(project, stageId),
            prompt: `Conversa da etapa:\n\n${transcript(state.messages)}\n\nDevolva o documento de arquitetura em "doc" (markdown, com diagrama mermaid erDiagram) e de 2 a 5 ADRs curtos em "adrs" (cada um com contexto, decisão e consequências no campo content, em markdown).`,
          },
        })) as { doc: string; adrs: Project["adrs"] };
        setProject((p) => ({
          ...p,
          adrs: res.adrs.map((a, i) => ({ ...a, number: a.number || i + 1 })),
          stages: { ...p.stages, [stageId]: { ...p.stages[stageId], doc: res.doc, stale: false } },
        }));
      } else if (stageId === "features") {
        const res = (await callJson({
          data: {
            kind: "features",
            system: docSystem(project, stageId),
            prompt: `Conversa da etapa:\n\n${transcript(state.messages)}\n\nProponha de 3 a 8 features derivadas do PRD. Para cada uma: name (curto), slug (kebab-case sem acento) e description (uma frase).`,
          },
        })) as { features: { name: string; slug: string; description: string }[] };

        const features: Feature[] = res.features.map((f) => ({
          slug: slugify(f.slug || f.name),
          name: f.name,
          description: f.description,
          spec: "",
          telas: "",
          wireframe: "",
        }));

        setBusy(`Gerando specs (0/${features.length})…`);
        for (let i = 0; i < features.length; i++) {
          const feature = features[i];
          if (!feature) continue;
          setBusy(`Gerando spec de ${feature.name} (${i + 1}/${features.length})…`);
          const spec = await callText({
            data: {
              system: docSystem(project, stageId),
              messages: [
                {
                  role: "user",
                  content: `Escreva a spec completa da feature "${feature.name}" (${feature.description}). Título do documento: "# ${String(i + 1).padStart(3, "0")}-${feature.slug} — ${feature.name}".`,
                },
              ],
            },
          });
          features[i] = { ...feature, spec: spec.text };
        }

        setProject((p) => ({
          ...p,
          features,
          stages: {
            ...p.stages,
            features: {
              ...p.stages.features,
              doc: features.map((f, i) => `- **${String(i + 1).padStart(3, "0")}-${f.slug}** — ${f.name}: ${f.description}`).join("\n"),
              stale: false,
            },
          },
        }));
      } else if (stageId === "telas") {
        const features = [...project.features];
        for (let i = 0; i < features.length; i++) {
          const feature = features[i];
          if (!feature) continue;
          setBusy(`Gerando telas de ${feature.name} (${i + 1}/${features.length})…`);
          const res = (await callJson({
            data: {
              kind: "telas",
              system: docSystem(project, stageId),
              prompt: `Feature: ${feature.name} — ${feature.description}\n\nSpec:\n${feature.spec}\n\nDevolva em "markdown" a descrição das telas (elementos + tabela Ação do usuário → Resultado esperado) e em "wireframeHtml" um wireframe simples e completo em HTML+CSS inline, tons de cinza, sem imagens, sem scripts, representando a tela principal.`,
            },
          })) as { markdown: string; wireframeHtml: string };
          features[i] = { ...feature, telas: res.markdown, wireframe: res.wireframeHtml };
        }
        setProject((p) => ({
          ...p,
          features,
          stages: {
            ...p.stages,
            telas: { ...p.stages.telas, doc: features.map((f) => `- ${f.name}`).join("\n"), stale: false },
          },
        }));
      } else if (stageId === "tarefas") {
        const tasks: Task[] = [];
        let counter = 1;
        for (let i = 0; i < project.features.length; i++) {
          const feature = project.features[i];
          if (!feature) continue;
          setBusy(`Gerando tarefas de ${feature.name} (${i + 1}/${project.features.length})…`);
          const folder = `${String(i + 1).padStart(3, "0")}-${feature.slug}`;
          const res = (await callJson({
            data: {
              kind: "tasks",
              system: docSystem(project, stageId),
              prompt: `Feature: ${feature.name} (pasta ${folder})\n\nSpec:\n${feature.spec}\n\nTelas:\n${feature.telas}\n\nQuebre em 2 a 6 tarefas pequenas. Cada item: "code" (T001, T002... continuando a partir de T${String(counter).padStart(3, "0")}), "title" e "markdown" seguindo EXATAMENTE o template de tarefa, com o campo Feature preenchido como ${folder}.`,
            },
          })) as { tasks: { code: string; title: string; markdown: string }[] };

          res.tasks.forEach((t) => {
            const code = `T${String(counter).padStart(3, "0")}`;
            counter += 1;
            tasks.push({
              code,
              featureSlug: feature.slug,
              title: t.title,
              markdown: t.markdown.replace(/^#\s*T\d+/, `# ${code}`),
              done: false,
            });
          });
        }
        setProject((p) => ({
          ...p,
          tasks,
          stages: {
            ...p.stages,
            tarefas: {
              ...p.stages.tarefas,
              doc: tasks.map((t) => `- ${t.code} — ${t.title}`).join("\n"),
              stale: false,
            },
          },
        }));
      } else {
        toast.info("Esta etapa não gera documento por IA.");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }

    void stage;
  }, [activeStage, project, callText, callJson, patchStage]);

  const approveStage = useCallback(
    (id: StageId) => {
      setProject((p) => {
        const index = STAGES.findIndex((s) => s.id === id);
        const stages = { ...p.stages };
        stages[id] = { ...stages[id], status: "concluida", stale: false };
        const next = STAGES[index + 1];
        if (next && stages[next.id].status === "bloqueada") {
          stages[next.id] = { ...stages[next.id], status: "andamento" };
        }
        return { ...p, stages };
      });
      const next = STAGES[STAGES.findIndex((s) => s.id === id) + 1];
      if (next) setActiveStage(next.id);
      toast.success("Etapa aprovada.");
    },
    [],
  );

  const reopenStage = useCallback((id: StageId) => {
    setProject((p) => {
      const index = STAGES.findIndex((s) => s.id === id);
      const stages = { ...p.stages };
      stages[id] = { ...stages[id], status: "andamento" };
      STAGES.slice(index + 1).forEach((s) => {
        if (stages[s.id].status === "concluida") stages[s.id] = { ...stages[s.id], stale: true };
      });
      return { ...p, stages };
    });
  }, []);

  const setDoc = useCallback((id: StageId, doc: string) => patchStage(id, { doc }), [patchStage]);

  const updateFeature = useCallback((slug: string, patch: Partial<Feature>) => {
    setProject((p) => ({
      ...p,
      features: p.features.map((f) => (f.slug === slug ? { ...f, ...patch } : f)),
    }));
  }, []);

  const removeFeature = useCallback((slug: string) => {
    setProject((p) => ({ ...p, features: p.features.filter((f) => f.slug !== slug) }));
  }, []);

  const moveFeature = useCallback((slug: string, delta: number) => {
    setProject((p) => {
      const features = [...p.features];
      const index = features.findIndex((f) => f.slug === slug);
      const target = index + delta;
      if (index === -1 || target < 0 || target >= features.length) return p;
      [features[index], features[target]] = [features[target], features[index]];
      return { ...p, features };
    });
  }, []);

  const addFeature = useCallback((name: string) => {
    const slug = slugify(name);
    if (!slug) return;
    setProject((p) => ({
      ...p,
      features: [...p.features, { slug, name, description: "", spec: "", telas: "", wireframe: "" }],
    }));
  }, []);

  const updateTask = useCallback((code: string, patch: Partial<Task>) => {
    setProject((p) => ({ ...p, tasks: p.tasks.map((t) => (t.code === code ? { ...t, ...patch } : t)) }));
  }, []);

  const importStatus = useCallback((content: string) => {
    const parsed = parseStatusMd(content);
    setProject((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.code in parsed ? { ...t, done: parsed[t.code] } : t)),
    }));
    toast.success(`${Object.keys(parsed).length} tarefas lidas do STATUS.md.`);
  }, []);

  const buildVerification = useCallback(() => {
    setProject((p) => {
      const items = p.tasks.flatMap((task) =>
        acceptanceCriteria(task.markdown).map((text, i) => ({
          id: `${task.code}-${i}`,
          text: `${task.code} — ${text}`,
          done: false,
        })),
      );
      const previous = new Map(p.verification.map((v) => [v.id, v.done]));
      return { ...p, verification: items.map((i) => ({ ...i, done: previous.get(i.id) ?? false })) };
    });
  }, []);

  const toggleVerification = useCallback((id: string) => {
    setProject((p) => ({
      ...p,
      verification: p.verification.map((v) => (v.id === id ? { ...v, done: !v.done } : v)),
    }));
  }, []);

  return {
    project,
    hydrated,
    activeStage,
    setActiveStage,
    busy,
    progress,
    resetProject,
    renameProject,
    sendMessage,
    generateDoc,
    approveStage,
    reopenStage,
    setDoc,
    updateFeature,
    removeFeature,
    moveFeature,
    addFeature,
    updateTask,
    importStatus,
    buildVerification,
    toggleVerification,
  };
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("402")) return "Créditos de IA esgotados. Adicione créditos para continuar.";
  if (raw.includes("429")) return "Muitas requisições seguidas. Aguarde alguns segundos e tente de novo.";
  return `Falha ao falar com a IA: ${raw}`;
}
