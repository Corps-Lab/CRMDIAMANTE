import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TopClientsChart } from "@/components/dashboard/TopClientsChart";
import { RevenueGoalCard } from "@/components/dashboard/RevenueGoalCard";
import { useClients } from "@/contexts/ClientContext";
import { DollarSign, CreditCard, TrendingUp, Clock } from "lucide-react";

const Index = () => {
  const { clients, totalFaturamento } = useClients();
  const [goal, setGoal] = useState(15000);

  // Calculate metrics from clients data
  const metricsData = {
    faturamento: totalFaturamento,
    despesas: 0,
    receitaAnual: 0,
    pendentes: 0,
  };

  // Get top clients sorted by value
  const topClientsData = [...clients]
    .sort((a, b) => b.valorPago - a.valorPago)
    .slice(0, 10)
    .map((client) => ({
      name: client.razaoSocial.length > 15 
        ? client.razaoSocial.substring(0, 15) + "..." 
        : client.razaoSocial,
      value: client.valorPago,
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
            value={formatCurrency(metricsData.pendentes)}
            icon={<Clock className="w-6 h-6" />}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TopClientsChart data={topClientsData} />
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
