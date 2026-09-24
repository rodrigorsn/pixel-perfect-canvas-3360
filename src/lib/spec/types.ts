export type StageId =
  | "brainstorm"
  | "prd"
  | "arquitetura"
  | "features"
  | "telas"
  | "tarefas"
  | "implementacao"
  | "verificacao";

export type StageStatus = "pendente" | "andamento" | "concluida" | "bloqueada";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StageState {
  status: StageStatus;
  messages: ChatMessage[];
  doc: string;
  stale: boolean;
}

export interface Adr {
  number: number;
  title: string;
  content: string;
}

export interface Feature {
  slug: string;
  name: string;
  description: string;
  spec: string;
  telas: string;
  pages: Page[];
}

export interface Behavior {
  trigger: string;
  expectedResult: string;
  errorCase: string;
}

export interface Component {
  id: string;
  name: string;
  description: string;
  behaviors: Behavior[];
}

export interface Page {
  id: string;
  name: string;
  route: string;
  purpose: string;
  components: Component[];
  wireframe: string;
}

export interface Task {
  code: string;
  featureSlug: string;
  title: string;
  markdown: string;
  done: boolean;
  kind: TaskKind;
  dependsOn: string[];
}

export type TaskKind = "prototype" | "functional";

export interface VerificationItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Project {
  name: string;
  createdAt: string;
  stages: Record<StageId, StageState>;
  adrs: Adr[];
  features: Feature[];
  tasks: Task[];
  verification: VerificationItem[];
  agentsMd: string;
}
