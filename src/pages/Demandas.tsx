import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { DemandForm } from "@/components/demands/DemandForm";
import { DemandCard } from "@/components/demands/DemandCard";
import { useDemands } from "@/contexts/DemandContext";
import { useClients } from "@/contexts/ClientContext";
import { Demand, DemandFormData, statusOptions } from "@/types/demand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, eachWeekOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, ClipboardList, Calendar, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Demandas() {
  const { demands, addDemand, removeDemand, updateDemand } = useDemands();
  const { totalFaturamento } = useClients();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");

  const filteredDemands = useMemo(() => {
    return demands.filter((d) => {
      const matchesSearch =
        d.demanda.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.responsavel.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [demands, searchTerm, statusFilter]);

  const handleSubmit = async (data: DemandFormData) => {
    if (editingDemand) {
      await updateDemand(editingDemand.id, data);
      setEditingDemand(null);
    } else {
      await addDemand(data);
    }
  };

  const handleEdit = (demand: Demand) => {
    setEditingDemand(demand);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingDemand(null);
  };

  // Week navigation
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Month navigation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthWeeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

  const getDemandsByDay = (date: Date) => {
    return filteredDemands.filter((d) => isSameDay(new Date(d.dataEntrega), date));
  };

  const stats = {
    total: demands.length,
    pendentes: demands.filter((d) => d.status === "pendente").length,
    emAndamento: demands.filter((d) => d.status === "em_andamento").length,
    concluidas: demands.filter((d) => d.status === "concluida").length,
  };

  return (
    <MainLayout totalCaixa={totalFaturamento}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Demandas</h1>
              <p className="text-sm text-muted-foreground">
                Gestão de entregas e tarefas
              </p>
            </div>
          </div>

          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Demanda
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-info">{stats.pendentes}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Em Andamento</p>
            <p className="text-2xl font-bold text-primary">{stats.emAndamento}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Concluídas</p>
            <p className="text-2xl font-bold text-primary">{stats.concluidas}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar demanda, cliente ou responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Calendar Views */}
        <div className="p-6 rounded-xl bg-card border border-border card-glow">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList className="bg-secondary">
                <TabsTrigger value="dia">Dia</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
                <TabsTrigger value="mes">Mês</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (view === "semana") setCurrentDate(subWeeks(currentDate, 1));
                    else if (view === "mes") setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
                    else setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)));
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[150px] text-center">
                  {view === "dia" && format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
                  {view === "semana" && `${format(weekStart, "dd/MM")} - ${format(weekEnd, "dd/MM")}`}
                  {view === "mes" && format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (view === "semana") setCurrentDate(addWeeks(currentDate, 1));
                    else if (view === "mes") setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
                    else setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)));
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Day View */}
            <TabsContent value="dia" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getDemandsByDay(currentDate).length > 0 ? (
                  getDemandsByDay(currentDate).map((demand) => (
                    <DemandCard
                      key={demand.id}
                      demand={demand}
                      onEdit={handleEdit}
                      onDelete={removeDemand}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    Nenhuma demanda para este dia
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Week View */}
            <TabsContent value="semana" className="space-y-4">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayDemands = getDemandsByDay(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[200px] p-2 rounded-lg border",
                        isToday(day) ? "border-primary bg-primary/5" : "border-border bg-secondary/30"
                      )}
                    >
                      <div className="text-center mb-2">
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(day, "EEE", { locale: ptBR })}
                        </p>
                        <p className={cn(
                          "text-lg font-bold",
                          isToday(day) ? "text-primary" : "text-foreground"
                        )}>
                          {format(day, "dd")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {dayDemands.slice(0, 3).map((d) => (
                          <div
                            key={d.id}
                            className="p-1.5 rounded bg-card text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                            onClick={() => handleEdit(d)}
                          >
                            <p className="font-medium truncate">{d.demanda}</p>
                            <p className="text-muted-foreground truncate">{d.clientName}</p>
                          </div>
                        ))}
                        {dayDemands.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{dayDemands.length - 3} mais
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Month View */}
            <TabsContent value="mes" className="space-y-4">
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              {monthWeeks.map((weekStart) => {
                const days = eachDayOfInterval({
                  start: weekStart,
                  end: endOfWeek(weekStart, { weekStartsOn: 1 }),
                });
                return (
                  <div key={weekStart.toISOString()} className="grid grid-cols-7 gap-1">
                    {days.map((day) => {
                      const dayDemands = getDemandsByDay(day);
                      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-[60px] p-1 rounded text-center",
                            isCurrentMonth ? "bg-secondary/30" : "bg-transparent opacity-30",
                            isToday(day) && "ring-1 ring-primary"
                          )}
                        >
                          <span className={cn("text-xs", isToday(day) && "text-primary font-bold")}>
                            {format(day, "d")}
                          </span>
                          {dayDemands.length > 0 && (
                            <div className="mt-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                              {dayDemands.length > 1 && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  {dayDemands.length}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>

        {/* All Demands List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">Todas as Demandas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDemands.length > 0 ? (
              filteredDemands.map((demand) => (
                <DemandCard
                  key={demand.id}
                  demand={demand}
                  onEdit={handleEdit}
                  onDelete={removeDemand}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma demanda encontrada</p>
                <p className="text-sm text-muted-foreground">Clique em "Nova Demanda" para começar</p>
              </div>
            )}
          </div>
        </div>

        {/* Form Modal */}
        <DemandForm
          open={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          defaultValues={
            editingDemand
              ? {
                  clientId: editingDemand.clientId,
                  demanda: editingDemand.demanda,
                  descricao: editingDemand.descricao,
                  dataPedido: editingDemand.dataPedido,
                  dataEntrega: editingDemand.dataEntrega,
                  responsavel: editingDemand.responsavel,
                  status: editingDemand.status,
                  prioridade: editingDemand.prioridade,
                  tarefas: editingDemand.tarefas,
                }
              : undefined
          }
          isEdit={!!editingDemand}
        />
      </div>
    </MainLayout>
  );
}
