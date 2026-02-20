export type SupplierDocType = "cpf" | "cnpj";

export interface Supplier {
  id: string;
  razaoSocial: string;
  docTipo: SupplierDocType;
  documento: string;
  endereco: string;
  responsavel: string;
  contato: string;
  createdAt: Date;
}

export type SupplierFormData = Omit<Supplier, "id" | "createdAt">;
