export type TicketStatus = "aberto" | "em_andamento" | "concluido";
export type TicketTipo = "hidraulica" | "eletrica" | "acabamento" | "estrutura" | "outros";

export interface Ticket {
  id: string;
  unidade: string;
  cliente: string;
  contato: string;
  tipo: TicketTipo;
  status: TicketStatus;
  prazo: string; // ISO date
  descricao: string;
  responsavel?: string | null;
  createdAt: Date;
}

export type TicketFormData = Omit<Ticket, "id" | "createdAt">;
