export interface Client {
  id: string;
  razaoSocial: string;
  cnpj: string;
  cpf?: string | null;
  endereco: string;
  valorPago: number;
  recorrencia: "mensal" | "trimestral" | "semestral" | "anual";
  responsavel: string;
  contatoInterno: string;
  createdAt: Date;
}

export type ClientFormData = Omit<Client, "id" | "createdAt">;

export const recorrenciaOptions = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
] as const;
