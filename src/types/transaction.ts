export interface Transaction {
  id: string;
  tipo: "entrada" | "despesa";
  descricao: string;
  valor: number;
  categoria: string;
  mes: number; // 1-12
  ano: number;
  vencimento?: number; // dia do mês (1-31). Default: 5
  payerType?: "cliente" | "colaborador" | "outro";
  referenciaNome?: string; // nome do cliente ou colaborador
  clientId?: string;
  clientName?: string;
  originSaleId?: string | null;
  originType?: "manual" | "venda" | "comissao" | "outro" | null;
  createdAt: Date;
}

export type TransactionFormData = Omit<Transaction, "id" | "createdAt" | "clientName">;

export const meses = [
  { value: 1, label: "Janeiro", short: "Jan" },
  { value: 2, label: "Fevereiro", short: "Fev" },
  { value: 3, label: "Março", short: "Mar" },
  { value: 4, label: "Abril", short: "Abr" },
  { value: 5, label: "Maio", short: "Mai" },
  { value: 6, label: "Junho", short: "Jun" },
  { value: 7, label: "Julho", short: "Jul" },
  { value: 8, label: "Agosto", short: "Ago" },
  { value: 9, label: "Setembro", short: "Set" },
  { value: 10, label: "Outubro", short: "Out" },
  { value: 11, label: "Novembro", short: "Nov" },
  { value: 12, label: "Dezembro", short: "Dez" },
] as const;

export const categorias = {
  entrada: [
    "Serviços",
    "Produtos",
    "Consultoria",
    "Mensalidade",
    "Projeto",
    "Outros",
  ],
  despesa: [
    "Salários",
    "Aluguel",
    "Marketing",
    "Ferramentas",
    "Impostos",
    "Fornecedores",
    "Outros",
  ],
};
