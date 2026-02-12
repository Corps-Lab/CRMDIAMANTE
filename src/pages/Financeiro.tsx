import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionForm } from "@/components/financeiro/TransactionForm";
import { MonthlyGrid } from "@/components/financeiro/MonthlyGrid";
import { useTransactions } from "@/contexts/TransactionContext";
import { useClients } from "@/contexts/ClientContext";
import { TransactionFormData } from "@/types/transaction";
import { Button } from "@/components/ui/button";
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

export default function Financeiro() {
  const { transactions, addTransaction, removeTransaction, getMonthlyTotals, totalEntradas, totalDespesas } = useTransactions();
  const { totalFaturamento } = useClients();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDefaults, setFormDefaults] = useState<{ mes?: number; tipo?: "entrada" | "despesa" }>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthlyTotals = getMonthlyTotals(selectedYear);
  const chartData = monthlyTotals.map((m) => ({
    name: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m.mes - 1],
    entradas: m.entradas,
    despesas: m.despesas,
    saldo: m.entradas - m.despesas,
  }));

  const saldoTotal = totalEntradas - totalDespesas;

  const handleAddTransaction = (mes?: number, tipo?: "entrada" | "despesa") => {
    setFormDefaults({ mes, tipo });
    setIsFormOpen(true);
  };

  const handleSubmit = (data: TransactionFormData) => {
    addTransaction(data);
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

        <Tabs defaultValue="entradas" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px] bg-card border-border">
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
                className="gap-2 bg-green-600 hover:bg-green-500 text-white"
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
                variant="destructive"
                className="gap-2"
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
                className="gap-2 bg-green-600 hover:bg-green-500 text-white"
                onClick={() => handleAddTransaction(undefined, "entrada")}
              >
                <ArrowDownCircle className="w-4 h-4" />
                Criar Entrada
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
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
          open={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setFormDefaults({});
          }}
          onSubmit={handleSubmit}
          defaultMes={formDefaults.mes}
          defaultTipo={formDefaults.tipo}
        />
      </div>
    </MainLayout>
  );

  function renderSummaryCards() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-green-500/10">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(totalEntradas)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-red-500/10">
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Despesas</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(totalDespesas)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${saldoTotal >= 0 ? "bg-primary/10" : "bg-red-500/10"}`}>
              <DollarSign className={`w-5 h-5 ${saldoTotal >= 0 ? "text-primary" : "text-red-400"}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-2xl font-bold ${saldoTotal >= 0 ? "text-primary" : "text-red-400"}`}>
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
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 65%)", fontSize: 12 }} axisLine={{ stroke: "hsl(0 0% 18%)" }} />
              <YAxis tick={{ fill: "hsl(0 0% 65%)", fontSize: 12 }} axisLine={{ stroke: "hsl(0 0% 18%)" }} tickFormatter={(v) => `R$${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 18%)", borderRadius: "8px" }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" fill="url(#colorEntradas)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" fill="url(#colorDespesas)" strokeWidth={2} />
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
          transactions={transactions}
          ano={selectedYear}
          onAddTransaction={handleAddTransaction}
          onRemoveTransaction={removeTransaction}
        />
      </div>
    );
  }
}
