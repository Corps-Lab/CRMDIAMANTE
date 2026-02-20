export type ProjectStatus = "planejamento" | "em_obra" | "entregue";

export interface Unit {
  id: string;
  projectId: string;
  nome: string;
  area: number;
  preco: number;
  status: "disponivel" | "reservado" | "vendido";
}

export interface Project {
  id: string;
  nome: string;
  cidade: string;
  inicioPrevisto: string; // ISO date
  entregaPrevista: string; // ISO date
  status: ProjectStatus;
  progresso: number; // 0-100
  orcamento: number;
  gasto: number;
  createdAt: Date;
}

export type ProjectFormData = Omit<Project, "id" | "createdAt">;
export type UnitFormData = Omit<Unit, "id">;
