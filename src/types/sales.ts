export type LeadStage = "lead" | "proposta" | "reserva" | "contrato";

export interface Lead {
  id: string;
  nomeCliente: string;
  contato: string;
  origem: string;
  etapa: LeadStage;
  valor: number;
  unidade?: string | null; // referência textual da unidade ou id
  corretor?: string | null;
  observacoes?: string | null;
  createdAt: Date;
}

export type LeadFormData = Omit<Lead, "id" | "createdAt">;

export interface SaleCommunication {
  id: string;
  leadId?: string | null;
  leadNomeCliente: string;
  unidade?: string | null;
  valorVenda: number;
  percentualComissao: number;
  valorComissao: number;
  brokerNome: string;
  brokerCpf: string;
  brokerCreci?: string | null;
  brokerCode: string;
  createdAt: string;
  registradoPor?: string | null;
  contractId?: string | null;
  entradaTransactionId?: string | null;
  comissaoTransactionId?: string | null;
}

export interface SaleCommunicationInput {
  leadId?: string | null;
  leadNomeCliente: string;
  unidade?: string | null;
  valorVenda: number;
  brokerNome: string;
  brokerCpf: string;
  brokerCreci?: string | null;
  brokerCode: string;
  registradoPor?: string | null;
  autoCreateContract?: boolean;
  autoCreateFinance?: boolean;
}

export interface CommissionSettings {
  percentual: number;
  updatedAt: string;
  updatedBy?: string | null;
}
