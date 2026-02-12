import { createContext, useContext, useState, ReactNode } from "react";
import { Transaction, TransactionFormData } from "@/types/transaction";
import { useClients } from "./ClientContext";
import { safeId } from "@/lib/safeId";

interface TransactionContextType {
  transactions: Transaction[];
  addTransaction: (data: TransactionFormData) => void;
  removeTransaction: (id: string) => void;
  updateTransaction: (id: string, data: Partial<TransactionFormData>) => void;
  getTransactionsByMonth: (mes: number, ano: number) => Transaction[];
  getMonthlyTotals: (ano: number) => { mes: number; entradas: number; despesas: number }[];
  totalEntradas: number;
  totalDespesas: number;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

// Dados zerados para novo ciclo
const initialTransactions: Transaction[] = [];

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const { clients } = useClients();

  const addTransaction = (data: TransactionFormData) => {
    const client = data.clientId ? clients.find((c) => c.id === data.clientId) : null;
    const newTransaction: Transaction = {
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
    setTransactions((prev) => [...prev, newTransaction]);
  };

  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTransaction = (id: string, data: Partial<TransactionFormData>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
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

  const totalEntradas = transactions.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0);
  const totalDespesas = transactions.filter((t) => t.tipo === "despesa").reduce((acc, t) => acc + t.valor, 0);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
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
