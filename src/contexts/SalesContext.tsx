import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  CommissionSettings,
  Lead,
  LeadFormData,
  SaleCommunication,
  SaleCommunicationInput,
} from "@/types/sales";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";
import { normalizeBrokerCode, normalizeCpf } from "@/lib/brokerRegistry";

interface SalesContextType {
  leads: Lead[];
  loading: boolean;
  commissionSettings: CommissionSettings;
  saleCommunications: SaleCommunication[];
  addLead: (data: LeadFormData) => Promise<void>;
  updateLead: (id: string, data: LeadFormData) => Promise<void>;
  moveLead: (id: string, etapa: Lead["etapa"]) => Promise<void>;
  removeLead: (id: string) => Promise<void>;
  setCommissionPercent: (percentual: number, updatedBy?: string | null) => Promise<void>;
  registerSaleCommunication: (input: SaleCommunicationInput) => Promise<SaleCommunication>;
  refreshSalesData: () => Promise<void>;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

type LeadRow = {
  id: string;
  nome_cliente: string;
  contato: string;
  origem: string;
  etapa: Lead["etapa"];
  valor: number | string;
  unidade: string | null;
  corretor: string | null;
  observacoes: string | null;
  created_at: string;
};

type SaleCommunicationRow = {
  id: string;
  lead_id: string | null;
  lead_nome_cliente: string;
  unidade: string | null;
  valor_venda: number | string;
  percentual_comissao: number | string;
  valor_comissao: number | string;
  broker_nome: string;
  broker_cpf: string;
  broker_creci: string | null;
  broker_code: string;
  created_at: string;
};

export function SalesProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({
    percentual: 5,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  });
  const [saleCommunications, setSaleCommunications] = useState<SaleCommunication[]>([]);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_leads`, [currentAgency.id]);
  const commissionStorageKey = useMemo(
    () => `crm_${currentAgency.id}_sales_commission`,
    [currentAgency.id],
  );
  const communicationsStorageKey = useMemo(
    () => `crm_${currentAgency.id}_sales_communications`,
    [currentAgency.id],
  );

  const mapLeadRow = (l: LeadRow): Lead => ({
    id: l.id,
    nomeCliente: l.nome_cliente,
    contato: l.contato,
    origem: l.origem,
    etapa: l.etapa,
    valor: Number(l.valor || 0),
    unidade: l.unidade,
    corretor: l.corretor,
    observacoes: l.observacoes,
    createdAt: new Date(l.created_at),
  });

  const mapSaleCommunicationRow = (row: SaleCommunicationRow): SaleCommunication => ({
    id: row.id,
    leadId: row.lead_id,
    leadNomeCliente: row.lead_nome_cliente,
    unidade: row.unidade,
    valorVenda: Number(row.valor_venda || 0),
    percentualComissao: Number(row.percentual_comissao || 0),
    valorComissao: Number(row.valor_comissao || 0),
    brokerNome: row.broker_nome,
    brokerCpf: row.broker_cpf,
    brokerCreci: row.broker_creci,
    brokerCode: row.broker_code,
    createdAt: row.created_at,
  });

  const persistLocalLeads = (next: Lead[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setLeads(next);
  };

  const persistLocalCommission = (next: CommissionSettings) => {
    localStorage.setItem(commissionStorageKey, JSON.stringify(next));
    setCommissionSettings(next);
  };

  const persistLocalCommunications = (next: SaleCommunication[]) => {
    localStorage.setItem(communicationsStorageKey, JSON.stringify(next));
    setSaleCommunications(next);
  };

  const loadLocalCommissionAndCommunications = () => {
    try {
      const rawCommission = localStorage.getItem(commissionStorageKey);
      if (rawCommission) {
        const parsed = JSON.parse(rawCommission) as CommissionSettings;
        if (typeof parsed?.percentual === "number") {
          setCommissionSettings({
            percentual: Number(parsed.percentual),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
            updatedBy: parsed.updatedBy || null,
          });
        }
      }
    } catch {
      setCommissionSettings({
        percentual: 5,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      });
    }

    try {
      const raw = localStorage.getItem(communicationsStorageKey);
      const parsed = raw ? (JSON.parse(raw) as SaleCommunication[]) : [];
      setSaleCommunications(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSaleCommunications([]);
    }
  };

  const refreshSalesData = async () => {
    setLoading(true);
    if (!user || isIsolated) {
      try {
        const raw = localStorage.getItem(storageKey);
        setLeads(raw ? JSON.parse(raw) : []);
      } catch {
        setLeads([]);
      }
      loadLocalCommissionAndCommunications();
      setLoading(false);
      return;
    }

    try {
      const [leadsResult, commissionResult, communicationsResult] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase
          .from("sales_commission_settings")
          .select("*")
          .eq("agency_id", currentAgency.id)
          .maybeSingle(),
        supabase
          .from("sales_communications")
          .select("*")
          .eq("agency_id", currentAgency.id)
          .order("created_at", { ascending: false }),
      ]);

      if (leadsResult.error) throw leadsResult.error;
      const mappedLeads =
        leadsResult.data?.map((row) => mapLeadRow(row as unknown as LeadRow)) || [];
      setLeads(mappedLeads);

      if (commissionResult.error) {
        throw commissionResult.error;
      }
      const commission = commissionResult.data;
      setCommissionSettings({
        percentual: Number(commission?.percentual || 5),
        updatedAt: commission?.updated_at || new Date().toISOString(),
        updatedBy: commission?.updated_by || null,
      });

      if (communicationsResult.error) throw communicationsResult.error;
      const mappedComms =
        communicationsResult.data?.map((row) =>
          mapSaleCommunicationRow(row as unknown as SaleCommunicationRow),
        ) || [];
      setSaleCommunications(mappedComms);
    } catch (err) {
      console.error("Erro ao carregar dados de vendas no Supabase, usando fallback local.", err);
      try {
        const raw = localStorage.getItem(storageKey);
        setLeads(raw ? JSON.parse(raw) : []);
      } catch {
        setLeads([]);
      }
      loadLocalCommissionAndCommunications();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSalesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isIsolated, storageKey, currentAgency.id]);

  const addLead = async (data: LeadFormData) => {
    if (!user || isIsolated) {
      const newLead: Lead = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      persistLocalLeads([newLead, ...leads]);
      return;
    }
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert({
        nome_cliente: data.nomeCliente,
        contato: data.contato,
        origem: data.origem,
        etapa: data.etapa,
        valor: data.valor,
        unidade: data.unidade,
        corretor: data.corretor,
        observacoes: data.observacoes,
      })
      .select()
      .single();
    if (error) throw error;
    setLeads((prev) => [mapLeadRow(inserted as unknown as LeadRow), ...prev]);
  };

  const updateLead = async (id: string, data: LeadFormData) => {
    if (!user || isIsolated) {
      const next = leads.map((l) => (l.id === id ? { ...l, ...data } : l));
      persistLocalLeads(next);
      return;
    }
    const { data: updated, error } = await supabase
      .from("leads")
      .update({
        nome_cliente: data.nomeCliente,
        contato: data.contato,
        origem: data.origem,
        etapa: data.etapa,
        valor: data.valor,
        unidade: data.unidade,
        corretor: data.corretor,
        observacoes: data.observacoes,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? mapLeadRow(updated as unknown as LeadRow) : l)),
    );
  };

  const moveLead = async (id: string, etapa: Lead["etapa"]) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    await updateLead(id, { ...lead, etapa });
  };

  const removeLead = async (id: string) => {
    if (!user || isIsolated) {
      persistLocalLeads(leads.filter((l) => l.id !== id));
      return;
    }
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) throw error;
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const setCommissionPercent = async (percentual: number, updatedBy?: string | null) => {
    const safePercent = Number.isFinite(percentual)
      ? Math.min(100, Math.max(0, Number(percentual)))
      : 0;
    const next = {
      percentual: Number(safePercent.toFixed(2)),
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || null,
    };

    if (!user || isIsolated) {
      persistLocalCommission(next);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("sales_commission_settings")
        .upsert(
          {
            agency_id: currentAgency.id,
            percentual: next.percentual,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "agency_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      setCommissionSettings({
        percentual: Number(data.percentual || 0),
        updatedAt: data.updated_at || next.updatedAt,
        updatedBy: data.updated_by || null,
      });
    } catch (err) {
      console.error("Erro ao salvar comissão no Supabase, usando fallback local.", err);
      persistLocalCommission(next);
    }
  };

  const registerSaleCommunication = async (input: SaleCommunicationInput) => {
    const valorVenda = Number(input.valorVenda || 0);

    if (!user || isIsolated) {
      const percentualComissao = Number(commissionSettings.percentual || 0);
      const valorComissao = Number(((valorVenda * percentualComissao) / 100).toFixed(2));

      const communication: SaleCommunication = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        leadId: input.leadId || null,
        leadNomeCliente: input.leadNomeCliente.trim(),
        unidade: input.unidade || null,
        valorVenda,
        percentualComissao,
        valorComissao,
        brokerNome: input.brokerNome.trim(),
        brokerCpf: normalizeCpf(input.brokerCpf),
        brokerCreci: input.brokerCreci?.trim().toUpperCase() || null,
        brokerCode: normalizeBrokerCode(input.brokerCode),
        createdAt: new Date().toISOString(),
        registradoPor: input.registradoPor || null,
      };

      const next = [communication, ...saleCommunications];
      persistLocalCommunications(next);
      return communication;
    }

    const rpcArgs = {
      _agency_id: currentAgency.id,
      _lead_id: input.leadId || null,
      _lead_nome_cliente: input.leadNomeCliente,
      _unidade: input.unidade || null,
      _valor_venda: valorVenda,
      _broker_nome: input.brokerNome,
      _broker_cpf: input.brokerCpf,
      _broker_creci: input.brokerCreci || null,
      _broker_code: input.brokerCode,
      _create_contract: input.autoCreateContract !== false,
      _create_finance: input.autoCreateFinance !== false,
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "process_sale_communication",
      rpcArgs,
    );
    if (rpcError) throw rpcError;

    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!rpcRow?.communication_id) {
      throw new Error("Não foi possível registrar a venda.");
    }

    const { data: inserted, error: fetchError } = await supabase
      .from("sales_communications")
      .select("*")
      .eq("id", rpcRow.communication_id)
      .single();
    if (fetchError) throw fetchError;

    const mapped = mapSaleCommunicationRow(inserted as unknown as SaleCommunicationRow);
    const enriched: SaleCommunication = {
      ...mapped,
      contractId: rpcRow.contract_id || null,
      entradaTransactionId: rpcRow.entrada_transaction_id || null,
      comissaoTransactionId: rpcRow.comissao_transaction_id || null,
    };

    await refreshSalesData();
    return enriched;
  };

  return (
    <SalesContext.Provider
      value={{
        leads,
        loading,
        commissionSettings,
        saleCommunications,
        addLead,
        updateLead,
        moveLead,
        removeLead,
        setCommissionPercent,
        registerSaleCommunication,
        refreshSalesData,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales must be used within a SalesProvider");
  return ctx;
}
