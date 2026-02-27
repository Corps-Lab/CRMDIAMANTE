export interface Client {
  id: string;
  razaoSocial: string;
  cnpj: string;
  cpf?: string | null;
  endereco: string;
  valorPago: number;
  recorrencia:
    | "a_vista"
    | "parcelado"
    | "boleto"
    | "financiamento"
    | "consorcio"
    | "permuta"
    | "mensal"
    | "trimestral"
    | "semestral"
    | "anual";
  responsavel: string;
  contatoInterno: string;
  createdAt: Date;
}

export type ClientFormData = Omit<Client, "id" | "createdAt">;

export const recorrenciaOptions = [
  { value: "a_vista", label: "À vista" },
  { value: "parcelado", label: "Parcelado (direto)" },
  { value: "boleto", label: "Boleto" },
  { value: "financiamento", label: "Financiamento bancário" },
  { value: "consorcio", label: "Consórcio" },
  { value: "permuta", label: "Permuta" },
] as const;

export const recorrenciaLabels: Record<string, string> = {
  a_vista: "À vista",
  parcelado: "Parcelado (direto)",
  boleto: "Boleto",
  financiamento: "Financiamento bancário",
  consorcio: "Consórcio",
  permuta: "Permuta",
  // Compatibilidade com cadastros antigos
  mensal: "Mensal (legado)",
  trimestral: "Trimestral (legado)",
  semestral: "Semestral (legado)",
  anual: "Anual (legado)",
};
