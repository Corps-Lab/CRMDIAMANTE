import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";
import { Contract } from "@/types/contract";
import { ContractSchemaType } from "@/lib/contract-validations";
import { useClients } from "./ClientContext";
import { safeId } from "@/lib/safeId";
import { useAgency } from "./AgencyContext";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SaleContractInput {
  clientId?: string | null;
  clientName: string;
  titulo: string;
  valorContrato: number;
  conteudo?: string;
  saleCommunicationId?: string | null;
  status?: Contract["status"];
}

interface ContractContextType {
  contracts: Contract[];
  loading: boolean;
  addContract: (data: ContractSchemaType) => Promise<Contract | null>;
  addContractFromSale: (data: SaleContractInput) => Promise<Contract | null>;
  removeContract: (id: string) => Promise<void>;
  updateContract: (id: string, data: Partial<ContractSchemaType>) => Promise<void>;
  getContractsByClient: (clientId: string) => Contract[];
  refresh: () => Promise<void>;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

type ContractRow = {
  id: string;
  client_id: string | null;
  client_name_snapshot: string;
  titulo: string;
  valor_contrato: number | string;
  recorrencia: Contract["recorrencia"];
  data_inicio: string;
  data_fim: string | null;
  status: Contract["status"];
  conteudo: string;
  created_at: string;
};

export function ContractProvider({ children }: { children: ReactNode }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const { clients } = useClients();
  const { currentAgency, isIsolated } = useAgency();
  const { user } = useAuth();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_contracts`, [currentAgency.id]);

  const mapRow = (row: ContractRow): Contract => {
    const clientNameFromList =
      row.client_id && row.client_id !== ""
        ? clients.find((c) => c.id === row.client_id)?.razaoSocial
        : null;
    return {
      id: row.id,
      clientId: row.client_id || "",
      clientName: clientNameFromList || row.client_name_snapshot || "Cliente não encontrado",
      titulo: row.titulo,
      valorContrato: Number(row.valor_contrato || 0),
      recorrencia: row.recorrencia,
      dataInicio: new Date(row.data_inicio),
      dataFim: row.data_fim ? new Date(row.data_fim) : null,
      status: row.status,
      conteudo: row.conteudo,
      createdAt: new Date(row.created_at),
    };
  };

  const persistLocal = (next: Contract[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setContracts(next);
  };

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed: Contract[] = raw ? JSON.parse(raw) : [];
      setContracts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setContracts([]);
    }
  };

  const refresh = async () => {
    setLoading(true);
    if (!user || isIsolated) {
      loadLocal();
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map((row) => mapRow(row as unknown as ContractRow));
      setContracts(mapped);
    } catch (err) {
      console.error("Erro ao carregar contratos no Supabase, usando fallback local.", err);
      loadLocal();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAgency.id, isIsolated, user?.id, clients.length]);

  const addContract = async (data: ContractSchemaType) => {
    const client = clients.find((c) => c.id === data.clientId);
    const newContract: Contract = {
      id: safeId("contract"),
      clientId: data.clientId,
      clientName: client?.razaoSocial || "Cliente não encontrado",
      titulo: data.titulo,
      valorContrato: data.valorContrato,
      recorrencia: data.recorrencia,
      dataInicio: data.dataInicio,
      dataFim: data.dataFim,
      status: data.status,
      conteudo: data.conteudo,
      createdAt: new Date(),
    };

    if (!user || isIsolated) {
      persistLocal([newContract, ...contracts]);
      return newContract;
    }

    try {
      const payload = {
        client_id: data.clientId || null,
        client_name_snapshot: client?.razaoSocial || "Cliente não encontrado",
        titulo: data.titulo,
        valor_contrato: data.valorContrato,
        recorrencia: data.recorrencia,
        data_inicio: data.dataInicio.toISOString().slice(0, 10),
        data_fim: data.dataFim ? data.dataFim.toISOString().slice(0, 10) : null,
        status: data.status,
        conteudo: data.conteudo,
        created_by: user.id,
      };

      const { data: inserted, error } = await supabase
        .from("contracts")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;

      const mapped = mapRow(inserted as unknown as ContractRow);
      setContracts((prev) => [mapped, ...prev]);
      return mapped;
    } catch (err) {
      console.error("Erro ao salvar contrato no Supabase, usando fallback local.", err);
      persistLocal([newContract, ...contracts]);
      return newContract;
    }
  };

  const addContractFromSale = async (data: SaleContractInput) => {
    const startDate = new Date();
    const draft: Contract = {
      id: safeId("contract"),
      clientId: data.clientId || "",
      clientName: data.clientName,
      titulo: data.titulo,
      valorContrato: data.valorContrato,
      recorrencia: "unico",
      dataInicio: startDate,
      dataFim: null,
      status: data.status || "pendente",
      conteudo:
        data.conteudo ||
        "Contrato gerado automaticamente a partir da comunicação de venda.",
      createdAt: new Date(),
    };

    if (!user || isIsolated) {
      persistLocal([draft, ...contracts]);
      return draft;
    }

    try {
      const { data: inserted, error } = await supabase
        .from("contracts")
        .insert({
          client_id: data.clientId || null,
          client_name_snapshot: data.clientName,
          titulo: data.titulo,
          valor_contrato: data.valorContrato,
          recorrencia: "unico",
          data_inicio: startDate.toISOString().slice(0, 10),
          data_fim: null,
          status: data.status || "pendente",
          conteudo:
            data.conteudo ||
            "Contrato gerado automaticamente a partir da comunicação de venda.",
          sale_communication_id: data.saleCommunicationId || null,
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      const mapped = mapRow(inserted as unknown as ContractRow);
      setContracts((prev) => [mapped, ...prev]);
      return mapped;
    } catch (err) {
      console.error("Erro ao gerar contrato da venda no Supabase, usando fallback local.", err);
      persistLocal([draft, ...contracts]);
      return draft;
    }
  };

  const removeContract = async (id: string) => {
    if (!user || isIsolated) {
      persistLocal(contracts.filter((contract) => contract.id !== id));
      return;
    }
    try {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
      setContracts((prev) => prev.filter((contract) => contract.id !== id));
    } catch (err) {
      console.error("Erro ao remover contrato no Supabase", err);
      throw err;
    }
  };

  const updateContract = async (id: string, data: Partial<ContractSchemaType>) => {
    const client = data.clientId ? clients.find((c) => c.id === data.clientId) : null;
    if (!user || isIsolated) {
      persistLocal(
        contracts.map((contract) =>
          contract.id === id
            ? {
                ...contract,
                ...data,
                clientId: data.clientId !== undefined ? data.clientId : contract.clientId,
                clientName: client?.razaoSocial || contract.clientName,
              }
            : contract,
        ),
      );
      return;
    }

    const payload: Record<string, unknown> = {};
    if (data.clientId !== undefined) {
      payload.client_id = data.clientId || null;
      payload.client_name_snapshot = client?.razaoSocial || contracts.find((c) => c.id === id)?.clientName || "";
    }
    if (data.titulo !== undefined) payload.titulo = data.titulo;
    if (data.valorContrato !== undefined) payload.valor_contrato = data.valorContrato;
    if (data.recorrencia !== undefined) payload.recorrencia = data.recorrencia;
    if (data.dataInicio !== undefined) payload.data_inicio = data.dataInicio.toISOString().slice(0, 10);
    if (data.dataFim !== undefined) payload.data_fim = data.dataFim ? data.dataFim.toISOString().slice(0, 10) : null;
    if (data.status !== undefined) payload.status = data.status;
    if (data.conteudo !== undefined) payload.conteudo = data.conteudo;

    if (Object.keys(payload).length === 0) return;

    try {
      const { data: updated, error } = await supabase
        .from("contracts")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const mapped = mapRow(updated as unknown as ContractRow);
      setContracts((prev) => prev.map((contract) => (contract.id === id ? mapped : contract)));
    } catch (err) {
      console.error("Erro ao atualizar contrato no Supabase", err);
      throw err;
    }
  };

  const getContractsByClient = (clientId: string) => {
    return contracts.filter((contract) => contract.clientId === clientId);
  };

  return (
    <ContractContext.Provider
      value={{
        contracts,
        loading,
        addContract,
        addContractFromSale,
        removeContract,
        updateContract,
        getContractsByClient,
        refresh,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export function useContracts() {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContracts must be used within a ContractProvider");
  }
  return context;
}
