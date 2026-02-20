export interface TaskItem {
  id: string;
  titulo: string;
  concluida: boolean;
}

export interface Demand {
  id: string;
  clientId: string;
  clientName: string;
  demanda: string;
  descricao: string;
  dataPedido: Date;
  dataEntrega: Date;
  responsavel: string;
  status: "pendente" | "em_andamento" | "concluida" | "atrasada";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  tarefas: TaskItem[];
  createdAt: Date;
}

export type DemandFormData = Omit<Demand, "id" | "createdAt" | "clientName">;

export const statusOptions = [
  { value: "pendente", label: "Pendente", color: "bg-primary/20 text-primary" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-primary/20 text-primary" },
  { value: "concluida", label: "Concluída", color: "bg-primary/20 text-primary" },
  { value: "atrasada", label: "Atrasada", color: "bg-info/20 text-info" },
] as const;

export const prioridadeOptions = [
  { value: "baixa", label: "Baixa", color: "bg-slate-500/20 text-slate-400" },
  { value: "media", label: "Média", color: "bg-info/20 text-info" },
  { value: "alta", label: "Alta", color: "bg-orange-500/20 text-orange-400" },
  { value: "urgente", label: "Urgente", color: "bg-info/20 text-info" },
] as const;
