import { Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface RevenueGoalCardProps {
  current: number;
  goal: number;
  onEditGoal?: (value: number) => void;
}

export function RevenueGoalCard({ current, goal, onEditGoal }: RevenueGoalCardProps) {
  const percentage = Math.min((current / goal) * 100, 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="p-6 rounded-xl bg-card border border-primary/35 card-glow">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-primary">Meta de Faturamento</h3>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          onClick={() => {
            if (!onEditGoal) return;
            const input = prompt("Nova meta (R$)", goal.toString());
            if (!input) return;
            const value = Number(input.replace(/[^\d.,]/g, "").replace(",", "."));
            if (isNaN(value) || value <= 0) return alert("Digite um valor válido.");
            onEditGoal(value);
          }}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <Progress 
          value={percentage} 
          className="h-3 bg-secondary [&>div]:bg-primary [&>div]:transition-[width] [&>div]:duration-500"
        />

        <p className="text-4xl font-bold text-primary text-center">
          {percentage.toFixed(1)}%
        </p>

        <div className="flex justify-between text-sm">
          <div className="text-center">
            <p className="text-muted-foreground uppercase tracking-wide">Atual:</p>
            <p className="font-semibold text-foreground">{formatCurrency(current)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground uppercase tracking-wide">Meta:</p>
            <p className="font-semibold text-foreground">{formatCurrency(goal)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
