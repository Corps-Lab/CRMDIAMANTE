import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Transaction, TransactionFormData } from "@/types/transaction";
import { useClients } from "./ClientContext";
import { safeId } from "@/lib/safeId";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

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
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { clients } = useClients();
  const { user } = useAuth();

  const mapRow = (row: Record<string, unknown>): Transaction => {
    const clientId = typeof row.client_id === "string" ? row.client_id : undefined;
    const valor = typeof row.valor === "number" ? row.valor : Number(row.valor ?? 0);
    const mes = typeof row.mes === "number" ? row.mes : Number(row.mes ?? 0);
    const ano = typeof row.ano === "number" ? row.ano : Number(row.ano ?? 0);
    const vencimento = typeof row.vencimento === "number" ? row.vencimento : undefined;
    const clientName = clients.find((c) => c.id === clientId)?.razaoSocial || undefined;
    return {
      id: String(row.id),
      tipo: (row.tipo as Transaction["tipo"]) ?? "entrada",
      descricao: (row.descricao as string) || "",
      valor,
      categoria: (row.categoria as string) || "",
      mes,
      ano,
      vencimento,
      clientId,
      clientName,
      createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
    };
  };

  const refresh = async () => {
    setLoading(true);
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTransactions((data || []).map(mapRow));
    } catch (err) {
      console.error("Erro ao carregar transações", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length, user]);

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
      createdAt: new Date(),
    };

    if (!user) throw new Error("Usuário não autenticado");

    const payload = {
      tipo: base.tipo,
      descricao: base.descricao,
      valor: base.valor,
      categoria: base.categoria,
      mes: base.mes,
      ano: base.ano,
      vencimento: base.vencimento,
      client_id: base.clientId || null,
    };

    try {
      const { data: inserted, error } = await supabase.from("transactions").insert(payload).select("*").single();
      if (error) throw error;
      setTransactions((prev) => [mapRow(inserted), ...prev]);
      refresh();
    } catch (err) {
      console.error("Erro ao salvar transação no Supabase", err);
      throw err;
    }
  };

  const removeTransaction = async (id: string) => {
    if (!user) throw new Error("Usuário não autenticado");
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      refresh();
    } catch (err) {
      console.error("Erro ao remover transação", err);
      throw err;
    }
  };

  const updateTransaction = async (id: string, data: Partial<TransactionFormData>) => {
    if (!user) throw new Error("Usuário não autenticado");

    const payload: Record<string, unknown> = {};
    if (data.tipo !== undefined) payload.tipo = data.tipo;
    if (data.descricao !== undefined) payload.descricao = data.descricao;
    if (data.valor !== undefined) payload.valor = data.valor;
    if (data.categoria !== undefined) payload.categoria = data.categoria;
    if (data.mes !== undefined) payload.mes = data.mes;
    if (data.ano !== undefined) payload.ano = data.ano;
    if (data.vencimento !== undefined) payload.vencimento = data.vencimento;
    if (data.clientId !== undefined) payload.client_id = data.clientId;
    // payer/ref not persisted on Supabase schema; skip

    if (Object.keys(payload).length === 0) return;

    try {
      const { data: updated, error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      setTransactions((prev) => prev.map((t) => (t.id === id ? mapRow(updated) : t)));
      refresh();
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
        entradas: monthTransactions.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0),
        despesas: monthTransactions.filter((t) => t.tipo === "despesa").reduce((acc, t) => acc + t.valor, 0),
      };
    });
  };

  const totalEntradas = useMemo(
    () => transactions.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0),
    [transactions]
  );
  const totalDespesas = useMemo(
    () => transactions.filter((t) => t.tipo === "despesa").reduce((acc, t) => acc + t.valor, 0),
    [transactions]
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
