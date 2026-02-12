import React, { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProgressRing } from "@/components/ui/progress-ring";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Calendar,
  Dumbbell,
  Scale,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProgress, StrengthRecord } from "@/hooks/useProgress";
import { AddWeightModal } from "@/components/progress/AddWeightModal";
import { AddStrengthModal } from "@/components/progress/AddStrengthModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

const Progress: React.FC = () => {
  const { profile } = useAuth();
  const {
    weightLogs,
    strengthRecords,
    isLoading,
    getWeeklyStats,
    calculateStreak,
    getWeightChartData,
    addWeightLog,
    upsertStrengthRecord,
    deleteStrengthRecord,
  } = useProgress();

  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);
  const [editingStrength, setEditingStrength] = useState<StrengthRecord | null>(null);

  const weeklyStats = getWeeklyStats();
  const { current: currentStreak, longest: longestStreak } = calculateStreak();
  const weightChartData = getWeightChartData();

  const trainingDays = Math.max(profile?.training_days || 5, 1);
  const completedDays = weeklyStats.filter((d) => d.completed).length;
  const weeklyProgress = Math.round(Math.min(1, completedDays / trainingDays) * 100);

  const currentWeight = weightLogs?.[0]?.weight ?? null;
  const initialWeight = weightLogs?.[weightLogs.length - 1]?.weight ?? null;

  const previousWeight = useMemo(() => {
    if (!weightLogs || weightLogs.length < 2) return null;
    return weightLogs[1]?.weight ?? null;
  }, [weightLogs]);

  const weightDiff = useMemo(() => {
    if (currentWeight == null || previousWeight == null) return null;
    const diff = Number((currentWeight - previousWeight).toFixed(1));
    return Number.isFinite(diff) ? diff : null;
  }, [currentWeight, previousWeight]);

  const formatWeightDisplay = (value: number | null | undefined) => (value == null ? "-" : `${value}kg`);

  const handleAddWeight = (data: { weight: number; bodyFatPercentage?: number; notes?: string }) => {
    addWeightLog.mutate(data, { onSuccess: () => setShowWeightModal(false) });
  };

  const handleAddStrength = (data: { exerciseName: string; initialWeight?: number; currentWeight: number; unit: string }) => {
    upsertStrengthRecord.mutate(
      { ...data, id: editingStrength?.id },
      {
        onSuccess: () => {
          setShowStrengthModal(false);
          setEditingStrength(null);
        },
      }
    );
  };

  const handleEditStrength = (record: StrengthRecord) => {
    setEditingStrength(record);
    setShowStrengthModal(true);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="px-4 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Sequência</span>
            </div>
            <span className="text-3xl font-bold text-foreground">{currentStreak}</span>
            <p className="text-xs text-muted-foreground mt-1">dias seguidos</p>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-secondary" />
              <span className="text-xs text-muted-foreground">Recorde</span>
            </div>
            <span className="text-3xl font-bold text-foreground">{longestStreak}</span>
            <p className="text-xs text-muted-foreground mt-1">dias</p>
          </div>
        </div>

        {/* Weekly Calendar */}
        <div className="card-elevated p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Esta Semana</h3>
            <span className="text-sm text-primary font-medium">
              {completedDays}/{trainingDays} treinos
            </span>
          </div>
          <div className="flex justify-between">
            {weeklyStats.map((day, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    day.completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {day.completed ? <Dumbbell className="w-4 h-4" /> : <span className="text-xs">{day.label.slice(0, 1).toUpperCase()}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{day.label.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weight Chart */}
        <div className="card-elevated p-5 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Evolução do Peso</h3>
              <p className="text-sm text-muted-foreground">
                {weightChartData.length > 0 ? `Últimos ${weightChartData.length} registros` : "Nenhum registro"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {weightDiff !== null && (
                <div className={cn("flex items-center gap-1", weightDiff < 0 ? "text-primary" : "text-secondary")}>
                  {weightDiff < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    {weightDiff > 0 ? "+" : ""}
                    {weightDiff}kg
                  </span>
                </div>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowWeightModal(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {weightChartData.length > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChartData}>
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis
                      domain={["dataMin - 1", "dataMax + 1"]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(v: number) => [`${v}kg`, "Peso"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <span className="text-lg font-bold text-foreground">{formatWeightDisplay(initialWeight)}</span>
                  <p className="text-xs text-muted-foreground">Início</p>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-primary">{formatWeightDisplay(currentWeight)}</span>
                  <p className="text-xs text-muted-foreground">Atual</p>
                </div>
                {profile?.weight && (
                  <div className="text-center">
                    <span className="text-lg font-bold text-secondary">{formatWeightDisplay(profile.weight)}</span>
                    <p className="text-xs text-muted-foreground">Meta</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Scale className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum registro de peso ainda</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowWeightModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Peso
              </Button>
            </div>
          )}
        </div>

        {/* Strength Progress */}
        <div className="card-elevated p-5 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Evolução de Força</h3>
              <p className="text-sm text-muted-foreground">Seus recordes pessoais</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setEditingStrength(null);
                setShowStrengthModal(true);
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {strengthRecords && strengthRecords.length > 0 ? (
            <div className="space-y-4">
              {strengthRecords.map((item) => {
                const progress =
                  item.initial_weight && item.current_weight
                    ? ((item.current_weight - item.initial_weight) / item.initial_weight) * 100
                    : 0;
                return (
                  <div key={item.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{item.exercise_name}</span>
                      <div className="flex items-center gap-2">
                        {item.initial_weight && (
                          <>
                            <span className="text-xs text-muted-foreground">
                              {item.initial_weight}
                              {item.unit}
                            </span>
                            <span className="text-xs">→</span>
                          </>
                        )}
                        <span className="text-sm font-semibold text-primary">
                          {item.current_weight}
                          {item.unit}
                        </span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditStrength(item)}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteStrengthRecord.mutate(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {item.initial_weight && progress > 0 && (
                      <>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-hero rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-primary mt-1">+{Math.round(progress)}%</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
              <Dumbbell className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum recorde registrado</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setEditingStrength(null);
                  setShowStrengthModal(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Recorde
              </Button>
            </div>
          )}
        </div>

        {/* Motivational Card */}
        <div className="card-elevated p-5 bg-gradient-to-r from-primary/10 to-secondary/10 animate-slide-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-4">
            <ProgressRing progress={Math.min(weeklyProgress, 100)} size={70} strokeWidth={5} variant="primary">
              <span className="text-sm font-bold">{Math.min(weeklyProgress, 100)}%</span>
            </ProgressRing>
            <div>
              {weeklyProgress >= 100 ? (
                <>
                  <h4 className="font-semibold text-foreground">Meta atingida! 🎉</h4>
                  <p className="text-sm text-muted-foreground mt-1">Parabéns! Você completou seus treinos da semana.</p>
                </>
              ) : (
                <>
                  <h4 className="font-semibold text-foreground">Continue assim! 💪</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {trainingDays - completedDays > 0 ? `Mais ${trainingDays - completedDays} treino(s) para bater sua meta semanal.` : "Você está no caminho certo!"}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddWeightModal open={showWeightModal} onOpenChange={setShowWeightModal} onSubmit={handleAddWeight} isLoading={addWeightLog.isPending} />

      <AddStrengthModal
        open={showStrengthModal}
        onOpenChange={(open) => {
          setShowStrengthModal(open);
          if (!open) setEditingStrength(null);
        }}
        onSubmit={handleAddStrength}
        isLoading={upsertStrengthRecord.isPending}
        editingRecord={editingStrength || undefined}
      />
    </MainLayout>
  );
};

export default Progress;
