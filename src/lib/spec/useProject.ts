import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { aiJson, aiText } from "../ai.functions";
import { markStagesStale, STAGES, stageById } from "./stages";
import {
  approvedContext,
  coherenceReviewSystem,
  docSystem,
  gapReviewSystem,
  interviewSystem,
  transcript,
} from "./prompts";
import { emptyProject, loadProject, saveProject, slugify } from "./storage";
import { WORKFLOW_TEXT, acceptanceCriteria, parseStatusMd } from "./export";
import { newId, pagesForPrompt, withPages } from "./pages";
import { preserveDone, renumberTasks, tasksFromAi, type AiTask } from "./tasks";
import type { CoherenceIssue, Feature, Page, Project, StageId, Task } from "./types";

export function useProject() {
  const [project, setProject] = useState<Project>(() => emptyProject());
  const [hydrated, setHydrated] = useState(false);
  const [activeStage, setActiveStage] = useState<StageId>("brainstorm");
  const [busy, setBusy] = useState<string | null>(null);
  const [coherenceIssues, setCoherenceIssues] = useState<{
    stageId: StageId;
    issues: CoherenceIssue[];
  } | null>(null);

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

  const updateFeature = useCallback((slug: string, patch: Partial<Feature>) => {
    setProject((p) => ({
      ...p,
      features: p.features.map((f) => {
        if (f.slug !== slug) return f;
        const next = { ...f, ...patch } as Feature;
        return patch.pages || patch.name ? withPages(next, next.pages) : next;
      }),
      stages: markStagesStale(p.stages, "features"),
    }));
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

  const generateFeatureTasks = useCallback(
    async (feature: Feature, index: number, others: Task[]): Promise<Task[]> => {
      const folder = `${String(index + 1).padStart(3, "0")}-${feature.slug}`;
      const existing = others.filter((t) => t.featureSlug !== feature.slug);
      const known = existing.length
        ? `\n\nTarefas de outras features (use estes códigos em dependsOn quando houver dependência):\n${existing.map((t) => `- ${t.code} — ${t.title} (${t.featureSlug})`).join("\n")}`
        : "";
      const res = parseJson(
        await callJson({
          data: {
            kind: "tasks",
            system: docSystem(project, "tarefas"),
            prompt: `Feature: ${feature.name} (pasta ${folder})\n\nSpec:\n${feature.spec}\n\nPáginas (JSON):\n${pagesForPrompt(feature)}${known}\n\nPreencha os campos estruturados (não escreva markdown). Regras:\n- kind "prototype": UMA tarefa por página, só visual (layout, componentes, estados vazio, carregando e erro com dados fictícios), sem banco, sem API e sem lógica de negócio.\n- kind "functional": tarefas que tornam os comportamentos reais (persistência, validações, integrações, regras de negócio), agrupando no máximo 3 a 5 comportamentos relacionados por tarefa. Cada tarefa funcional depende (dependsOn) da tarefa de protótipo da sua página.\n- "dependsOn": títulos exatos de tarefas desta mesma resposta ou códigos listados acima.\n- "actions": use os comportamentos das páginas envolvidas (action = trigger, expectedResult = expectedResult).\n- "files": caminhos seguindo a estrutura de pastas definida em docs/02-arquitetura.md.\n- "refs": ids como RF-02, ADR-0001.\n- "acceptanceCriteria" de tarefas funcionais deve cobrir, além do caminho feliz: entrada inválida/ausente, e — quando a tarefa lida com dado sensível (saúde, financeiro, dado pessoal), autenticação ou operação destrutiva (delete, alteração irreversível) — um critério explícito de controle de acesso ou proteção desse dado.\n- "howToVerify" de tarefas "functional" deve ser o comando que roda o teste automatizado que prova o comportamento, usando EXATAMENTE o runner/gerenciador de pacotes da seção "## Comandos" de docs/02-arquitetura.md (nunca troque de runner entre tarefas), escrito ANTES da implementação (TDD); tarefas "prototype" (sem lógica de negócio) podem usar um passo manual reproduzível. Nunca genérico como "funciona conforme esperado".\n- A tarefa descreve COMPORTAMENTO observável e critério de aceite, nunca a solução técnica de baixo nível (SQL exato, nome de índice, algoritmo criptográfico específico, formato interno de string/chave). Essas decisões de implementação ficam para o /plan, contra o código real — não as invente aqui.`,
          },
        }),
      ) as { tasks: AiTask[] };
      return tasksFromAi(feature, folder, res.tasks, existing);
    },
    [callJson, project],
  );

  const generateWireframe = useCallback(
    async (slug: string, pageId: string) => {
      const feature = project.features.find((f) => f.slug === slug);
      const page = feature?.pages.find((pg) => pg.id === pageId);
      if (!feature || !page) return;
      setBusy(`Gerando wireframe de ${page.name}…`);
      try {
        const res = parseJson(
          await callJson({
            data: {
              kind: "wireframe",
              system: docSystem(project, "telas"),
              prompt: `Feature: ${feature.name}\nPágina: ${page.name} (${page.route})\nObjetivo: ${page.purpose}\nComponentes:\n${JSON.stringify(
                page.components.map((c) => ({
                  name: c.name,
                  description: c.description,
                  behaviors: c.behaviors,
                })),
                null,
                1,
              )}\n\nDevolva em "html" um wireframe simples e completo desta página em HTML+CSS inline, tons de cinza, sem imagens, sem scripts, mostrando todos os componentes rotulados pelo nome.`,
            },
          }),
        ) as { html: string };
        setProject((p) => ({
          ...p,
          features: p.features.map((f) =>
            f.slug === slug
              ? {
                  ...f,
                  pages: f.pages.map((pg) =>
                    pg.id === pageId ? { ...pg, wireframe: res.html } : pg,
                  ),
                }
              : f,
          ),
        }));
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [project, callJson],
  );

  const setAgentsMd = useCallback(
    (agentsMd: string) => setProject((p) => ({ ...p, agentsMd })),
    [],
  );

  const generateAgentsMd = useCallback(async () => {
    setBusy("Gerando AGENTS.md…");
    try {
      const system = `Você é um arquiteto de software sênior. Escreva o arquivo AGENTS.md (constituição do repositório para agentes de código) com base nos documentos aprovados abaixo. Responda APENAS com o markdown, sem cercas de código externas.

Seções obrigatórias, nesta ordem:
# ${project.name} — Constituição do projeto
## Resumo do produto
## Stack — exatamente a stack de docs/02-arquitetura.md, sem inventar nada.
## Estrutura de pastas — copiada da arquitetura.
## Regras de código e invariantes — derivadas dos ADRs e dos RNFs do PRD.
## Comandos — copiados EXATAMENTE da seção "## Comandos" de docs/02-arquitetura.md, sem inventar nem trocar de gerenciador de pacotes/runner.
## Fluxo de trabalho — copie EXATAMENTE este texto, sem alterações:
${WORKFLOW_TEXT}

${approvedContext(project, "implementacao")}`;
      const res = await callText({
        data: { system, messages: [{ role: "user", content: "Gere o AGENTS.md." }] },
      });
      setAgentsMd(res.text);
      toast.success("AGENTS.md gerado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [project, callText, setAgentsMd]);

  const commitTasks = useCallback((build: (previous: Task[]) => Task[]) => {
    setProject((p) => {
      const tasks = renumberTasks(preserveDone(build(p.tasks), p.tasks), p.features);
      return {
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
      };
    });
  }, []);

  const regenerateFeatureTasks = useCallback(
    async (slug: string) => {
      const index = project.features.findIndex((f) => f.slug === slug);
      const feature = project.features[index];
      if (!feature) return;
      setBusy(`Gerando tarefas de ${feature.name}…`);
      try {
        const fresh = await generateFeatureTasks(feature, index, project.tasks);
        commitTasks((prev) => [...prev.filter((t) => t.featureSlug !== slug), ...fresh]);
        toast.success(`Tarefas de ${feature.name} regeneradas.`);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [project, generateFeatureTasks, commitTasks],
  );

  const generateDoc = useCallback(
    async (targetStageId?: StageId) => {
      const stageId = targetStageId ?? activeStage;
      const stage = stageById(stageId);
      const state = project.stages[stageId];
      const generatesContent: StageId[] = [
        "brainstorm",
        "prd",
        "arquitetura",
        "features",
        "telas",
        "tarefas",
      ];
      setBusy("Gerando documento…");

      try {
        if (stageId === "brainstorm" || stageId === "prd") {
          const res = await callText({
            data: {
              system: docSystem(project, stageId),
              messages: [
                { role: "user", content: `Conversa da etapa:\n\n${transcript(state.messages)}` },
              ],
            },
          });
          patchStage(stageId, { doc: res.text, stale: false });
          return res.text;
        } else if (stageId === "arquitetura") {
          const res = parseJson(
            await callJson({
              data: {
                kind: "arquitetura",
                system: docSystem(project, stageId),
                prompt: `Conversa da etapa:\n\n${transcript(state.messages)}\n\nDevolva o documento de arquitetura em "doc" (markdown, com diagrama mermaid erDiagram do modelo de dados e diagrama mermaid classDiagram das classes/entidades do domínio e como elas se relacionam) e de 2 a 5 ADRs curtos em "adrs" (cada um com contexto, decisão e consequências no campo content, em markdown). Se o produto tiver trilha de auditoria, inclua uma ADR classificando os eventos em "atomicamente obrigatórios" (a operação falha se a auditoria não gravar — ex.: exclusão, alteração de dado clínico sensível) e "best-effort durável" (a operação segue mesmo se a auditoria falhar, com retry/fila — ex.: login, leitura); nunca aplique fail-closed a todo evento indiscriminadamente.`,
              },
            }),
          ) as { doc: string; adrs: Project["adrs"] };
          setProject((p) => ({
            ...p,
            adrs: res.adrs.map((a, i) => ({ ...a, number: a.number || i + 1 })),
            stages: {
              ...p.stages,
              [stageId]: { ...p.stages[stageId], doc: res.doc, stale: false },
            },
          }));
          return res.doc;
        } else if (stageId === "features") {
          const res = parseJson(
            await callJson({
              data: {
                kind: "features",
                system: docSystem(project, stageId),
                prompt: `Conversa da etapa:\n\n${transcript(state.messages)}\n\nProponha de 3 a 8 features derivadas do PRD. Para cada uma: name (curto), slug (kebab-case sem acento) e description (uma frase). Antes de listar, identifique concerns transversais (ex.: consequência financeira de uma mudança de status, sincronização offline, auditoria) que mais de uma feature tocaria, e atribua cada um a UMA única feature dona — mencione essa decisão de ownership na description das features envolvidas (ex.: "dono de X" ou "consome X de Y"), nunca deixe implícito.`,
              },
            }),
          ) as { features: { name: string; slug: string; description: string }[] };

          const features: Feature[] = res.features.map((f) => ({
            slug: slugify(f.slug || f.name),
            name: f.name,
            description: f.description,
            spec: "",
            telas: "",
            pages: [],
          }));

          setProject((p) => ({
            ...p,
            features,
            stages: {
              ...p.stages,
              features: {
                ...p.stages.features,
                doc: features
                  .map(
                    (f, i) =>
                      `- **${String(i + 1).padStart(3, "0")}-${f.slug}** — ${f.name}: ${f.description}`,
                  )
                  .join("\n"),
                stale: false,
              },
            },
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
                    content: `Escreva a spec completa da feature "${feature.name}" (${feature.description}). Título do documento: "# ${String(i + 1).padStart(3, "0")}-${feature.slug} — ${feature.name}". Se a description indicar que esta feature é dona de um concern transversal, escreva a regra completa aqui. Se indicar que ela consome um concern de outra feature, referencie a feature dona (não reimplemente a regra).`,
                  },
                ],
              },
            });
            features[i] = { ...feature, spec: spec.text };
            updateFeature(feature.slug, { spec: spec.text });
          }

          return features
            .map((f, i) => `## ${String(i + 1).padStart(3, "0")}-${f.slug} — ${f.name}\n${f.spec}`)
            .join("\n\n");
        } else if (stageId === "telas") {
          const features = [...project.features];
          for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            if (!feature) continue;
            setBusy(`Gerando telas de ${feature.name} (${i + 1}/${features.length})…`);
            const res = parseJson(
              await callJson({
                data: {
                  kind: "telas",
                  system: docSystem(project, stageId),
                  prompt: `Feature: ${feature.name} — ${feature.description}\n\nSpec:\n${feature.spec}${componentCatalog(features)}\n\nDevolva "pages": as páginas da feature. Cada página: name, route (ex.: /tarefas), purpose (uma frase), components. Cada componente: name, description e behaviors (trigger = o que o usuário faz, expectedResult, errorCase). Reutilize componentes com o MESMO nome entre páginas (e das features anteriores listadas) em vez de inventar variações.`,
                },
              }),
            ) as { pages: Omit<Page, "id" | "wireframe">[] };
            const pages = res.pages.map((pg) => ({
              ...pg,
              id: newId(),
              wireframe: "",
              components: pg.components.map((c) => ({ ...c, id: newId() })),
            }));
            features[i] = withPages(feature, pages);
            updateFeature(feature.slug, { pages });
          }
          setProject((p) => ({
            ...p,
            stages: {
              ...p.stages,
              telas: {
                ...p.stages.telas,
                doc: features.map((f) => `- ${f.name}`).join("\n"),
                stale: false,
              },
            },
          }));
          return features.map((f) => `## ${f.name}\n${f.telas}`).join("\n\n");
        } else if (stageId === "tarefas") {
          const tasks: Task[] = [];
          for (let i = 0; i < project.features.length; i++) {
            const feature = project.features[i];
            if (!feature) continue;
            setBusy(`Gerando tarefas de ${feature.name} (${i + 1}/${project.features.length})…`);
            const fresh = await generateFeatureTasks(feature, i, tasks);
            tasks.push(...fresh);
            commitTasks((prev) => [
              ...prev.filter((t) => t.featureSlug !== feature.slug),
              ...fresh,
            ]);
          }
        } else {
          toast.info("Esta etapa não gera documento por IA.");
        }
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
        if (generatesContent.includes(stageId)) {
          setProject((p) => ({ ...p, stages: markStagesStale(p.stages, stageId) }));
        }
      }

      void stage;
      return undefined;
    },
    [
      activeStage,
      project,
      callText,
      callJson,
      patchStage,
      generateFeatureTasks,
      commitTasks,
      updateFeature,
    ],
  );

  const reviewGaps = useCallback(
    async (stageId: StageId, doc: string) => {
      setBusy("Revisando lacunas…");
      try {
        const res = await callText({
          data: {
            system: gapReviewSystem(project, stageId, doc),
            messages: [
              {
                role: "user",
                content: "Revise o documento gerado e me avise se falta algo importante.",
              },
            ],
          },
        });
        patchStage(stageId, { messages: [{ role: "assistant", content: res.text }] });
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [project, callText, patchStage],
  );

  const autoDrafted = useRef<Set<StageId>>(new Set());

  useEffect(() => {
    if (!hydrated || busy) return;
    const stage = stageById(activeStage);
    const state = project.stages[activeStage];
    const hasPriorContext = STAGES.some(
      (s) => s.num < stage.num && project.stages[s.id].doc.trim(),
    );
    if (
      stage.hasChat &&
      hasPriorContext &&
      state.status === "andamento" &&
      !state.doc &&
      state.messages.length === 0 &&
      !autoDrafted.current.has(activeStage)
    ) {
      autoDrafted.current.add(activeStage);
      void (async () => {
        const doc = await generateDoc(activeStage);
        const multiWithReview: StageId[] = ["features", "telas"];
        if (doc && (!stage.multi || multiWithReview.includes(stage.id))) {
          await reviewGaps(activeStage, doc);
        }
      })();
    }
  }, [hydrated, busy, activeStage, project, generateDoc, reviewGaps]);

  const approveStage = useCallback((id: StageId) => {
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
  }, []);

  const checkAndApprove = useCallback(
    async (id: StageId) => {
      if (stageById(id).num === 1) {
        approveStage(id);
        return;
      }
      setBusy("Verificando coerência…");
      try {
        const res = parseJson(
          await callJson({
            data: {
              kind: "coerencia",
              system: coherenceReviewSystem(project, id),
              prompt: "Verifique a coerência de todo o conteúdo listado no system prompt.",
            },
          }),
        ) as { issues: CoherenceIssue[] };
        if (res.issues.length === 0) {
          approveStage(id);
        } else {
          setCoherenceIssues({ stageId: id, issues: res.issues });
        }
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [project, callJson, approveStage],
  );

  const dismissCoherence = useCallback(() => setCoherenceIssues(null), []);

  const approveDespiteCoherence = useCallback(() => {
    if (coherenceIssues) approveStage(coherenceIssues.stageId);
    setCoherenceIssues(null);
  }, [coherenceIssues, approveStage]);

  const reopenStage = useCallback((id: StageId) => {
    setProject((p) => ({
      ...p,
      stages: markStagesStale({ ...p.stages, [id]: { ...p.stages[id], status: "andamento" } }, id),
    }));
  }, []);

  const setDoc = useCallback((id: StageId, doc: string) => {
    setProject((p) => ({
      ...p,
      stages: markStagesStale({ ...p.stages, [id]: { ...p.stages[id], doc } }, id),
    }));
  }, []);

  const removeFeature = useCallback((slug: string) => {
    setProject((p) => ({
      ...p,
      features: p.features.filter((f) => f.slug !== slug),
      stages: markStagesStale(p.stages, "features"),
    }));
  }, []);

  const moveFeature = useCallback((slug: string, delta: number) => {
    setProject((p) => {
      const features = [...p.features];
      const index = features.findIndex((f) => f.slug === slug);
      const target = index + delta;
      if (index === -1 || target < 0 || target >= features.length) return p;
      const a = features[index]!;
      const b = features[target]!;
      features[index] = b;
      features[target] = a;
      return { ...p, features };
    });
  }, []);

  const addFeature = useCallback((name: string) => {
    const slug = slugify(name);
    if (!slug) return;
    setProject((p) => ({
      ...p,
      features: [...p.features, { slug, name, description: "", spec: "", telas: "", pages: [] }],
      stages: markStagesStale(p.stages, "features"),
    }));
  }, []);

  const updateTask = useCallback((code: string, patch: Partial<Task>) => {
    setProject((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.code === code ? ({ ...t, ...patch } as Task) : t)),
    }));
  }, []);

  const importStatus = useCallback((content: string) => {
    const parsed = parseStatusMd(content);
    setProject((p) => ({
      ...p,
      tasks: p.tasks.map((t) => ({ ...t, done: parsed[t.code] ?? t.done })),
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
      return {
        ...p,
        verification: items.map((i) => ({ ...i, done: previous.get(i.id) ?? false })),
      };
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
    regenerateFeatureTasks,
    generateWireframe,
    generateAgentsMd,
    setAgentsMd,
    approveStage,
    checkAndApprove,
    coherenceIssues,
    dismissCoherence,
    approveDespiteCoherence,
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

const parseJson = (r: { json: string }): unknown => JSON.parse(r.json);

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("402")) return "Créditos de IA esgotados. Adicione créditos para continuar.";
  if (raw.includes("429"))
    return "Muitas requisições seguidas. Aguarde alguns segundos e tente de novo.";
  return `Falha ao falar com a IA: ${raw}`;
}

function componentCatalog(features: Feature[]) {
  const names = [
    ...new Set(features.flatMap((f) => f.pages.flatMap((p) => p.components.map((c) => c.name)))),
  ];
  return names.length
    ? `\n\nComponentes já existentes (reutilize pelo nome): ${names.join(", ")}`
    : "";
}
