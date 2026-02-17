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

const storageKey = "crm_mock_transactions";

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { clients } = useClients();
  const { user } = useAuth();

  const mapRow = (row: any): Transaction => {
    const clientName = clients.find((c) => c.id === row.client_id)?.razaoSocial || undefined;
    return {
      id: row.id,
      tipo: row.tipo,
      descricao: row.descricao || "",
      valor: Number(row.valor),
      categoria: row.categoria || "",
      mes: row.mes,
      ano: row.ano,
      vencimento: row.vencimento || undefined,
      clientId: row.client_id || undefined,
      clientName,
      createdAt: new Date(row.created_at),
    };
  };

  const persistLocal = (next: Transaction[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore quota/private mode */
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Sem sessão -> usar armazenamento local
      if (!user) {
        try {
          const raw = localStorage.getItem(storageKey);
          const parsed: Transaction[] = raw ? JSON.parse(raw) : [];
          setTransactions(parsed.map((t) => ({ ...t, createdAt: new Date(t.createdAt) })));
        } catch {
          setTransactions([]);
        } finally {
          setLoading(false);
        }
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
    load();
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

    if (!user) {
      setTransactions((prev) => {
        const next = [base, ...prev];
        persistLocal(next);
        return next;
      });
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
    };

    try {
      const { data: inserted, error } = await supabase.from("transactions").insert(payload).select("*").single();
      if (error) throw error;
      setTransactions((prev) => [mapRow(inserted), ...prev]);
    } catch (err) {
      console.error("Erro ao salvar transação", err);
      throw err;
    }
  };

  const removeTransaction = async (id: string) => {
    if (!user) {
      setTransactions((prev) => {
        const next = prev.filter((t) => t.id !== id);
        persistLocal(next);
        return next;
      });
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
    if (!user) {
      setTransactions((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...data } : t));
        persistLocal(next);
        return next;
      });
      return;
    }

    const payload: any = {};
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
