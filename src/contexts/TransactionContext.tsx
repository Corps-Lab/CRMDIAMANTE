import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Transaction, TransactionFormData } from "@/types/transaction";
import { useClients } from "./ClientContext";
import { safeId } from "@/lib/safeId";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";

interface TransactionContextType {
  transactions: Transaction[];
  loading: boolean;
  addTransaction: (data: TransactionFormData) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, data: Partial<TransactionFormData>) => Promise<void>;
  getTransactionsByMonth: (mes: number, ano: number) => Transaction[];
  getMonthlyTotals: (ano: number) => { mes: number; entradas: number; despesas: number }[];
  totalEntradas: number;
  totalDespesas: number;
  refresh: () => Promise<void>;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

type TransactionRow = {
  id: string;
  tipo: Transaction["tipo"];
  descricao: string;
  valor: number | string;
  categoria: string;
  mes: number;
  ano: number;
  vencimento: number | null;
  client_id: string | null;
  created_at: string;
  origin_sale_id?: string | null;
  origin_type?: "manual" | "venda" | "comissao" | "outro" | null;
};

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { clients } = useClients();
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(
    () => `crm_${currentAgency.id}_transactions`,
    [currentAgency.id],
  );

  const mapRow = (row: TransactionRow): Transaction => {
    const clientId = row.client_id || undefined;
    const clientName = clientId
      ? clients.find((c) => c.id === clientId)?.razaoSocial
      : undefined;
    return {
      id: String(row.id),
      tipo: row.tipo || "entrada",
      descricao: row.descricao || "",
      valor: Number(row.valor || 0),
      categoria: row.categoria || "",
      mes: Number(row.mes || 0),
      ano: Number(row.ano || 0),
      vencimento: row.vencimento ?? undefined,
      clientId,
      clientName,
      originSaleId: row.origin_sale_id ?? null,
      originType: row.origin_type ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  };

  const persistLocal = (next: Transaction[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setTransactions(next);
  };

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as Transaction[]) : [];
      setTransactions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTransactions([]);
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
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTransactions((data || []).map((row) => mapRow(row as unknown as TransactionRow)));
    } catch (err) {
      console.error("Erro ao carregar transações no Supabase, usando fallback local.", err);
      loadLocal();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length, user?.id, isIsolated, currentAgency.id]);

  const addTransaction = async (data: TransactionFormData) => {
    const client = data.clientId ? clients.find((c) => c.id === data.clientId) : null;
    const base: Transaction = {
      id: safeId("txn"),
      tipo: data.tipo,
      descricao: data.descricao,
      valor: data.valor,
      categoria: data.categoria,
      mes: data.mes,
      ano: data.ano,
      vencimento: data.vencimento ?? 5,
      clientId: data.clientId,
      clientName: client?.razaoSocial,
      payerType: data.payerType,
      referenciaNome: data.referenciaNome || client?.razaoSocial,
      originSaleId: data.originSaleId ?? null,
      originType: data.originType ?? "manual",
      createdAt: new Date(),
    };

    if (!user || isIsolated) {
      persistLocal([base, ...transactions]);
      return;
    }

    const payload = {
      tipo: base.tipo,
      descricao: base.descricao,
      valor: base.valor,
      categoria: base.categoria,
      mes: base.mes,
      ano: base.ano,
      vencimento: base.vencimento,
      client_id: base.clientId || null,
      created_by: user.id,
      origin_sale_id: base.originSaleId || null,
      origin_type: base.originType || "manual",
    };

    try {
      const { data: inserted, error } = await supabase
        .from("transactions")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      setTransactions((prev) => [mapRow(inserted as unknown as TransactionRow), ...prev]);
    } catch (err) {
      console.error("Erro ao salvar transação no Supabase", err);
      throw err;
    }
  };

  const removeTransaction = async (id: string) => {
    if (!user || isIsolated) {
      persistLocal(transactions.filter((t) => t.id !== id));
      return;
    }
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Erro ao remover transação", err);
      throw err;
    }
  };

  const updateTransaction = async (id: string, data: Partial<TransactionFormData>) => {
    if (!user || isIsolated) {
      persistLocal(
        transactions.map((t) => (t.id === id ? { ...t, ...data } : t)),
      );
      return;
    }

    const payload: Record<string, unknown> = {};
    if (data.tipo !== undefined) payload.tipo = data.tipo;
    if (data.descricao !== undefined) payload.descricao = data.descricao;
    if (data.valor !== undefined) payload.valor = data.valor;
    if (data.categoria !== undefined) payload.categoria = data.categoria;
    if (data.mes !== undefined) payload.mes = data.mes;
    if (data.ano !== undefined) payload.ano = data.ano;
    if (data.vencimento !== undefined) payload.vencimento = data.vencimento;
    if (data.clientId !== undefined) payload.client_id = data.clientId || null;
    if (data.originSaleId !== undefined) payload.origin_sale_id = data.originSaleId || null;
    if (data.originType !== undefined) payload.origin_type = data.originType || "manual";

    if (Object.keys(payload).length === 0) return;

    try {
      const { data: updated, error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? mapRow(updated as unknown as TransactionRow) : t)),
      );
    } catch (err) {
      console.error("Erro ao atualizar transação", err);
      throw err;
    }
  };

  const getTransactionsByMonth = (mes: number, ano: number) => {
    return transactions.filter((t) => t.mes === mes && t.ano === ano);
  };

  const getMonthlyTotals = (ano: number) => {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const monthTransactions = transactions.filter((t) => t.mes === mes && t.ano === ano);
      return {
        mes,
        entradas: monthTransactions
          .filter((t) => t.tipo === "entrada")
          .reduce((acc, t) => acc + t.valor, 0),
        despesas: monthTransactions
          .filter((t) => t.tipo === "despesa")
          .reduce((acc, t) => acc + t.valor, 0),
      };
    });
  };

  const totalEntradas = useMemo(
    () => transactions.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0),
    [transactions],
  );
  const totalDespesas = useMemo(
    () => transactions.filter((t) => t.tipo === "despesa").reduce((acc, t) => acc + t.valor, 0),
    [transactions],
  );

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        loading,
        addTransaction,
        removeTransaction,
        updateTransaction,
        getTransactionsByMonth,
        getMonthlyTotals,
        totalEntradas,
        totalDespesas,
        refresh,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error("useTransactions must be used within a TransactionProvider");
  }
  return context;
}
