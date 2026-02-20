import { useState } from "react";
import { Transaction, meses } from "@/types/transaction";
import { Button } from "@/components/ui/button";
import { MessageCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthlyGridProps {
  transactions: Transaction[];
  ano: number;
  onAddTransaction: (mes: number, tipo: "entrada" | "despesa") => void;
  onRemoveTransaction: (id: string) => void;
  onSendCharge?: (transaction: Transaction) => void;
  sendingChargeId?: string | null;
}

export function MonthlyGrid({
  transactions,
  ano,
  onAddTransaction,
  onRemoveTransaction,
  onSendCharge,
  sendingChargeId,
}: MonthlyGridProps) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMonthData = (mes: number) => {
    const monthTransactions = transactions.filter((t) => t.mes === mes && t.ano === ano);
    const entradas = monthTransactions.filter((t) => t.tipo === "entrada");
    const despesas = monthTransactions.filter((t) => t.tipo === "despesa");
    const totalEntradas = entradas.reduce((acc, t) => acc + t.valor, 0);
    const totalDespesas = despesas.reduce((acc, t) => acc + t.valor, 0);
    const saldo = totalEntradas - totalDespesas;

    return { entradas, despesas, totalEntradas, totalDespesas, saldo };
  };

  return (
    <div className="space-y-4">
      {/* Grid Header */}
      <div className="grid grid-cols-12 gap-2">
        {meses.map((m) => {
          const data = getMonthData(m.value);
          const isExpanded = expandedMonth === m.value;

          return (
            <div
              key={m.value}
              className={cn(
                "rounded-lg border border-border bg-card p-3 cursor-pointer transition-all hover:border-primary/50",
                isExpanded && "col-span-12 md:col-span-6 lg:col-span-4"
              )}
              onClick={() => setExpandedMonth(isExpanded ? null : m.value)}
            >
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase">{m.short}</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    data.saldo >= 0 ? "text-primary" : "text-info"
                  )}
                >
                  {formatCurrency(data.saldo)}
                </p>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-2 rounded bg-primary/10">
                      <p className="text-primary font-medium">Entradas</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(data.totalEntradas)}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-info/10">
                      <p className="text-info font-medium">Despesas</p>
                      <p className="text-lg font-bold text-info">
                        {formatCurrency(data.totalDespesas)}
                      </p>
                    </div>
                  </div>

                  {/* Entradas List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-primary">Entradas</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => onAddTransaction(m.value, "entrada")}
                        type="button"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {data.entradas.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm group"
                        >
                          <div>
                            <p className="text-foreground">{t.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.referenciaNome || t.clientName || "—"} • {t.categoria}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {onSendCharge && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => onSendCharge(t)}
                                title="Cobrar no WhatsApp"
                                disabled={sendingChargeId === t.id}
                              >
                                {sendingChargeId === t.id ? (
                                  <span className="text-[10px] text-primary">...</span>
                                ) : (
                                  <MessageCircle className="w-3 h-3 text-primary" />
                                )}
                              </Button>
                            )}
                            <span className="text-primary font-medium">
                              +{formatCurrency(t.valor)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => onRemoveTransaction(t.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {data.entradas.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Nenhuma entrada
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Despesas List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-info">Despesas</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => onAddTransaction(m.value, "despesa")}
                        type="button"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {data.despesas.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm group"
                        >
                          <div>
                            <p className="text-foreground">{t.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.referenciaNome || "—"} • {t.categoria}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-info font-medium">
                              -{formatCurrency(t.valor)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => onRemoveTransaction(t.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {data.despesas.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Nenhuma despesa
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Clique em um mês para expandir e ver detalhes
      </p>
    </div>
  );
}
