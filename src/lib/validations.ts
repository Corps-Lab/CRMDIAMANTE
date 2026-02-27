import { z } from "zod";

// Documento helpers
const onlyNumbers = (value: string) => value.replace(/\D/g, "");

const validateCNPJ = (cnpj: string) => {
  const cleaned = onlyNumbers(cnpj);
  return cleaned.length === 14 && !/^(\d)\1+$/.test(cleaned);
};

const validateCPF = (cpf: string) => {
  const cleaned = onlyNumbers(cpf);
  return cleaned.length === 11 && !/^(\d)\1+$/.test(cleaned);
};

export const clientSchema = z.object({
  razaoSocial: z
    .string()
    .trim()
    .min(3, "Razão Social deve ter no mínimo 3 caracteres")
    .max(200, "Razão Social deve ter no máximo 200 caracteres"),
  cnpj: z
    .string()
    .trim()
    .refine((val) => validateCNPJ(val), "CNPJ inválido"),
  cpf: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((val) => (val ? validateCPF(val) : true), "CPF inválido"),
  endereco: z
    .string()
    .trim()
    .min(10, "Endereço deve ter no mínimo 10 caracteres")
    .max(300, "Endereço deve ter no máximo 300 caracteres"),
  valorPago: z
    .number({ invalid_type_error: "Valor deve ser um número" })
    .positive("Valor deve ser maior que zero")
    .max(10000000, "Valor muito alto"),
  recorrencia: z.enum(
    [
      "a_vista",
      "parcelado",
      "boleto",
      "financiamento",
      "consorcio",
      "permuta",
      // Compatibilidade com registros antigos
      "mensal",
      "trimestral",
      "semestral",
      "anual",
    ],
    {
      errorMap: () => ({ message: "Selecione uma forma de pagamento válida" }),
    },
  ),
  responsavel: z
    .string()
    .trim()
    .min(3, "Nome do responsável deve ter no mínimo 3 caracteres")
    .max(100, "Nome do responsável deve ter no máximo 100 caracteres"),
  contatoInterno: z
    .string()
    .trim()
    .min(8, "Contato deve ter no mínimo 8 caracteres")
    .max(50, "Contato deve ter no máximo 50 caracteres"),
});

export type ClientSchemaType = z.infer<typeof clientSchema>;

export const supplierSchema = z.object({
  razaoSocial: z
    .string()
    .trim()
    .min(3, "Nome/Razão Social deve ter no mínimo 3 caracteres")
    .max(200, "Nome/Razão Social deve ter no máximo 200 caracteres"),
  docTipo: z.enum(["cpf", "cnpj"], {
    errorMap: () => ({ message: "Selecione CPF ou CNPJ" }),
  }),
  documento: z
    .string()
    .trim()
    .min(11, "Documento muito curto")
    .max(18, "Documento muito longo")
    .refine((val, ctx) => {
      const tipo = ctx.parent?.docTipo;
      if (tipo === "cpf") return validateCPF(val);
      if (tipo === "cnpj") return validateCNPJ(val);
      return false;
    }, "Documento inválido"),
  endereco: z
    .string()
    .trim()
    .min(5, "Endereço deve ter no mínimo 5 caracteres")
    .max(300, "Endereço deve ter no máximo 300 caracteres"),
  responsavel: z
    .string()
    .trim()
    .min(3, "Responsável deve ter no mínimo 3 caracteres")
    .max(100, "Responsável deve ter no máximo 100 caracteres"),
  contato: z
    .string()
    .trim()
    .min(8, "Contato deve ter no mínimo 8 caracteres")
    .max(80, "Contato deve ter no máximo 80 caracteres"),
});

export type SupplierSchemaType = z.infer<typeof supplierSchema>;

// Obras / unidades
export const projectSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  cidade: z.string().trim().min(2).max(80),
  inicioPrevisto: z.string().trim(),
  entregaPrevista: z.string().trim(),
  status: z.enum(["planejamento", "em_obra", "entregue"]),
  progresso: z.number({ invalid_type_error: "Informe o progresso" }).min(0).max(100),
  orcamento: z.number({ invalid_type_error: "Informe o orçamento" }).min(0),
  gasto: z.number({ invalid_type_error: "Informe o gasto" }).min(0),
});

export type ProjectSchemaType = z.infer<typeof projectSchema>;

export const unitSchema = z.object({
  projectId: z.string().trim(),
  nome: z.string().trim().min(1).max(50),
  area: z.number({ invalid_type_error: "Informe a área" }).min(1),
  preco: z.number({ invalid_type_error: "Informe o preço" }).min(0),
  status: z.enum(["disponivel", "reservado", "vendido"], {
    errorMap: () => ({ message: "Selecione o status" }),
  }),
});

export type UnitSchemaType = z.infer<typeof unitSchema>;

// Pipeline de vendas
export const leadSchema = z.object({
  nomeCliente: z.string().trim().min(3).max(120),
  contato: z.string().trim().min(6).max(120),
  origem: z.string().trim().min(2).max(80),
  etapa: z.enum(["lead", "proposta", "reserva", "contrato"]),
  valor: z.number({ invalid_type_error: "Informe o valor" }).min(0),
  unidade: z.string().trim().optional().transform((v) => (v === "" ? null : v)),
  corretor: z.string().trim().optional().transform((v) => (v === "" ? null : v)),
  observacoes: z.string().trim().optional().transform((v) => (v === "" ? null : v)),
});

export type LeadSchemaType = z.infer<typeof leadSchema>;

// Assistência técnica
export const ticketSchema = z.object({
  unidade: z.string().trim().min(1).max(80),
  cliente: z.string().trim().min(3).max(120),
  contato: z.string().trim().min(6).max(120),
  tipo: z.enum(["hidraulica", "eletrica", "acabamento", "estrutura", "outros"]),
  status: z.enum(["aberto", "em_andamento", "concluido"]),
  prazo: z.string().trim(),
  descricao: z.string().trim().min(5).max(500),
  responsavel: z.string().trim().optional().transform((v) => (v === "" ? null : v)),
});

export type TicketSchemaType = z.infer<typeof ticketSchema>;

// RDO
export const rdoSchema = z.object({
  projectId: z.string().trim(),
  data: z.string().trim(),
  clima: z.string().trim().min(3).max(50),
  equipe: z.string().trim().min(3).max(200),
  horasTrabalhadas: z.number({ invalid_type_error: "Informe horas" }).min(0).max(24),
  atividades: z.string().trim().min(5).max(1000),
  impedimentos: z.string().trim().optional().transform((v) => (v === "" ? null : v)),
  observacoes: z.string().trim().optional().transform((v) => (v === "" ? null : v)),
});

export type RdoSchemaType = z.infer<typeof rdoSchema>;

// RFI
export const rfiSchema = z.object({
  projectId: z.string().trim(),
  titulo: z.string().trim().min(3).max(200),
  pergunta: z.string().trim().min(5).max(1000),
  solicitante: z.string().trim().min(3).max(120),
  responsavel: z.string().trim().min(3).max(120),
  prazo: z.string().trim(),
  status: z.enum(["aberto", "respondido", "fechado"]),
  resposta: z.string().trim().optional().transform((v) => (v === "" ? null : v)),
});

export type RfiSchemaType = z.infer<typeof rfiSchema>;
