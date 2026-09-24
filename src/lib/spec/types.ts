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
  wireframe: string;
}

export interface Task {
  code: string;
  featureSlug: string;
  title: string;
  markdown: string;
  done: boolean;
}

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
}
