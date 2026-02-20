export type RfiStatus = "aberto" | "respondido" | "fechado";

export interface Rfi {
  id: string;
  projectId: string;
  titulo: string;
  pergunta: string;
  solicitante: string;
  responsavel: string;
  prazo: string; // ISO date
  status: RfiStatus;
  resposta?: string | null;
  createdAt: Date;
}

export type RfiFormData = Omit<Rfi, "id" | "createdAt">;
