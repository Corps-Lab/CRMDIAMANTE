import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionForm } from "@/components/financeiro/TransactionForm";
import { MonthlyGrid } from "@/components/financeiro/MonthlyGrid";
import { useTransactions } from "@/contexts/TransactionContext";
import { useClients } from "@/contexts/ClientContext";
import { TransactionFormData } from "@/types/transaction";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Financeiro() {
  const { transactions, addTransaction, removeTransaction, getMonthlyTotals, totalEntradas, totalDespesas } = useTransactions();
  const { totalFaturamento } = useClients();
  const location = useLocation();
  const [entradaModal, setEntradaModal] = useState<{ open: boolean; mes?: number }>({ open: false });
  const [despesaModal, setDespesaModal] = useState<{ open: boolean; mes?: number }>({ open: false });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<"entradas" | "despesas" | "visao">("entradas");

  // Ajusta aba inicial conforme rota acessada (/entradas ou /despesas)
  useEffect(() => {
    if (location.pathname.includes("despesa")) {
      setTab("despesas");
    } else if (location.pathname.includes("entrada")) {
      setTab("entradas");
    }
  }, [location.pathname]);

  const filteredTransactions = useMemo(() => {
    if (tab === "entradas") return transactions.filter((t) => t.tipo === "entrada");
    if (tab === "despesas") return transactions.filter((t) => t.tipo === "despesa");
    return transactions;
  }, [transactions, tab]);

  const monthlyTotalsFiltered = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const monthTransactions = filteredTransactions.filter((t) => t.mes === mes && t.ano === selectedYear);
      return {
        mes,
        entradas: monthTransactions.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0),
        despesas: monthTransactions.filter((t) => t.tipo === "despesa").reduce((acc, t) => acc + t.valor, 0),
      };
    });
  }, [filteredTransactions, selectedYear]);

  const chartData = monthlyTotalsFiltered.map((m) => ({
    name: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m.mes - 1],
    entradas: m.entradas,
    despesas: m.despesas,
    saldo: m.entradas - m.despesas,
  }));

  const totalEntradasView = filteredTransactions.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0);
  const totalDespesasView = filteredTransactions.filter((t) => t.tipo === "despesa").reduce((acc, t) => acc + t.valor, 0);
  const saldoTotal = totalEntradasView - totalDespesasView;

  const handleAddTransaction = (mes?: number, tipo?: "entrada" | "despesa") => {
    const chosenTipo = tipo || (tab === "despesas" ? "despesa" : "entrada");
    if (chosenTipo === "despesa") setDespesaModal({ open: true, mes });
    else setEntradaModal({ open: true, mes });
  };

  const handleSubmit = async (data: TransactionFormData) => {
    await addTransaction(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout totalCaixa={totalFaturamento}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Controle de entradas e despesas mensais
              </p>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[112px] bg-card border-border">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TabsList>
              <TabsTrigger value="entradas">Entradas</TabsTrigger>
              <TabsTrigger value="despesas">Despesas</TabsTrigger>
              <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="entradas" className="space-y-6">
            <div className="flex justify-end">
              <Button
                type="button"
                className="gap-2"
                onClick={() => handleAddTransaction(undefined, "entrada")}
              >
                <ArrowDownCircle className="w-4 h-4" />
                Criar Entrada
              </Button>
            </div>
            {renderSummaryCards()}
            {renderChart()}
            {renderGrid()}
          </TabsContent>

          <TabsContent value="despesas" className="space-y-6">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleAddTransaction(undefined, "despesa")}
              >
                <ArrowUpCircle className="w-4 h-4" />
                Criar Despesa
              </Button>
            </div>
            {renderSummaryCards()}
            {renderChart()}
            {renderGrid()}
          </TabsContent>

          <TabsContent value="visao" className="space-y-6">
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                className="gap-2"
                onClick={() => handleAddTransaction(undefined, "entrada")}
              >
                <ArrowDownCircle className="w-4 h-4" />
                Criar Entrada
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleAddTransaction(undefined, "despesa")}
              >
                <ArrowUpCircle className="w-4 h-4" />
                Criar Despesa
              </Button>
            </div>
            {renderSummaryCards()}
            {renderChart()}
            {renderGrid()}
          </TabsContent>
        </Tabs>

        {/* Form Modal */}
        <TransactionForm
          open={entradaModal.open}
          onClose={() => setEntradaModal({ open: false })}
          onSubmit={handleSubmit}
          defaultMes={entradaModal.mes}
          defaultTipo="entrada"
        />
        <TransactionForm
          open={despesaModal.open}
          onClose={() => setDespesaModal({ open: false })}
          onSubmit={handleSubmit}
          defaultMes={despesaModal.mes}
          defaultTipo="despesa"
        />
      </div>
    </MainLayout>
  );

  function renderSummaryCards() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalEntradasView)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-info/10">
              <TrendingDown className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Despesas</p>
              <p className="text-2xl font-bold text-info">{formatCurrency(totalDespesasView)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${saldoTotal >= 0 ? "bg-primary/10" : "bg-info/10"}`}>
              <DollarSign className={`w-5 h-5 ${saldoTotal >= 0 ? "text-primary" : "text-info"}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-2xl font-bold ${saldoTotal >= 0 ? "text-primary" : "text-info"}`}>
                {formatCurrency(saldoTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderChart() {
    return (
      <div className="p-6 rounded-xl bg-card border border-border card-glow">
        <h3 className="text-lg font-semibold text-primary mb-4">Fluxo de Caixa - {selectedYear}</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} tickFormatter={(v) => `R$${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(var(--primary))" fill="url(#colorEntradas)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(var(--destructive))" fill="url(#colorDespesas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  function renderGrid() {
    return (
      <div className="p-6 rounded-xl bg-card border border-border card-glow">
        <h3 className="text-lg font-semibold text-primary mb-4">Visão Mensal - {selectedYear}</h3>
        <MonthlyGrid
          transactions={filteredTransactions}
          ano={selectedYear}
          onAddTransaction={handleAddTransaction}
          onRemoveTransaction={removeTransaction}
        />
      </div>
    );
  }
}
