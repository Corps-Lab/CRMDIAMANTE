export interface Contract {
  id: string;
  clientId: string;
  clientName: string;
  titulo: string;
  valorContrato: number;
  recorrencia: "mensal" | "trimestral" | "semestral" | "anual" | "unico";
  dataInicio: Date;
  dataFim: Date | null;
  status: "ativo" | "pendente" | "encerrado" | "cancelado";
  conteudo: string;
  createdAt: Date;
}

export type ContractFormData = Omit<Contract, "id" | "createdAt" | "clientName">;

export const contractStatusOptions = [
  { value: "ativo", label: "Ativo", color: "bg-primary/20 text-primary" },
  { value: "pendente", label: "Pendente", color: "bg-info/20 text-info" },
  { value: "encerrado", label: "Encerrado", color: "bg-muted text-muted-foreground" },
  { value: "cancelado", label: "Cancelado", color: "bg-info/20 text-info" },
] as const;

export const contractRecorrenciaOptions = [
  { value: "unico", label: "Pagamento Único" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
] as const;

// Template padrão de contrato com lacunas
export const defaultContractTemplate = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{RAZAO_SOCIAL}}
CNPJ: {{CNPJ}}
Endereço: {{ENDERECO}}
Responsável: {{RESPONSAVEL}}

CONTRATADA: [NOME DA SUA EMPRESA]
CNPJ: [SEU CNPJ]

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de {{SERVICO}} pela CONTRATADA à CONTRATANTE.

CLÁUSULA 2ª - DO VALOR E FORMA DE PAGAMENTO
Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor de {{VALOR}} ({{VALOR_EXTENSO}}), com recorrência {{RECORRENCIA}}.

O pagamento deverá ser efetuado até o dia {{DIA_VENCIMENTO}} de cada período.

CLÁUSULA 3ª - DO PRAZO
O presente contrato terá vigência a partir de {{DATA_INICIO}}, com término previsto para {{DATA_FIM}}.

CLÁUSULA 4ª - DAS OBRIGAÇÕES DA CONTRATADA
a) Executar os serviços conforme especificado;
b) Manter sigilo sobre informações da CONTRATANTE;
c) Emitir notas fiscais correspondentes.

CLÁUSULA 5ª - DAS OBRIGAÇÕES DA CONTRATANTE
a) Efetuar os pagamentos nas datas acordadas;
b) Fornecer informações necessárias à execução dos serviços;
c) Comunicar alterações que afetem o contrato.

CLÁUSULA 6ª - DA RESCISÃO
O contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 dias.

{{CIDADE}}, {{DATA_ATUAL}}

_________________________
CONTRATANTE: {{RESPONSAVEL}}

_________________________
CONTRATADA: [NOME DO RESPONSÁVEL]`;
