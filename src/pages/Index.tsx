import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TopClientsChart } from "@/components/dashboard/TopClientsChart";
import { RevenueGoalCard } from "@/components/dashboard/RevenueGoalCard";
import { useClients } from "@/contexts/ClientContext";
import { DollarSign, CreditCard, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/contexts/TransactionContext";
import { useDemands } from "@/contexts/DemandContext";

const Index = () => {
  const { totalFaturamento } = useClients();
  const { totalEntradas, totalDespesas, getMonthlyTotals } = useTransactions();
  const { demands } = useDemands();
  const { user } = useAuth();
  const storageKey = useMemo(() => `crm_revenue_goal_${user?.id ?? "anon"}`, [user?.id]);
  const [goal, setGoal] = useState(15000);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed > 0) setGoal(parsed);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, goal.toString());
    } catch {
      /* ignore storage errors */
    }
  }, [goal, storageKey]);

  const monthlyTotals = getMonthlyTotals(currentYear);
  const faturamentoReal = totalEntradas > 0 ? totalEntradas : totalFaturamento;
  const receitaLiquidaAno = monthlyTotals.reduce((acc, month) => acc + (month.entradas - month.despesas), 0);
  const mesesCorridos = new Date().getMonth() + 1;
  const receitaAnualProjetada = mesesCorridos > 0 ? (receitaLiquidaAno / mesesCorridos) * 12 : receitaLiquidaAno;
  const pendentes = demands.filter((d) => d.status === "pendente" || d.status === "atrasada").length;

  const metricsData = {
    faturamento: faturamentoReal,
    despesas: totalDespesas,
    receitaAnual: receitaAnualProjetada,
    pendentes,
  };

  const faturamentoChartData = monthlyTotals.map((month) => ({
    name: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][
      month.mes - 1
    ],
    value: month.entradas,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout totalCaixa={metricsData.faturamento}>
      <div className="space-y-6 animate-fade-in">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Faturamento"
            value={formatCurrency(metricsData.faturamento)}
            icon={<DollarSign className="w-6 h-6" />}
            variant="primary"
          />
          <MetricCard
            title="Despesas"
            value={formatCurrency(metricsData.despesas)}
            icon={<CreditCard className="w-6 h-6" />}
          />
          <MetricCard
            title="Receita Anual Projetada"
            value={formatCurrency(metricsData.receitaAnual)}
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <MetricCard
            title="Pendentes"
            value={new Intl.NumberFormat("pt-BR").format(metricsData.pendentes)}
            icon={<Clock className="w-6 h-6" />}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TopClientsChart
              data={faturamentoChartData}
              title={`Faturamento Mensal (${currentYear})`}
              subtitle="Entradas por mês"
              valueLabel="Faturamento"
            />
          </div>
          <div>
          <RevenueGoalCard current={metricsData.faturamento} goal={goal} onEditGoal={(v) => setGoal(v)} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
