import { useEffect, useMemo, useState } from "react";
import { useDemands } from "@/contexts/DemandContext";
import { useTransactions } from "@/contexts/TransactionContext";

export type NotificationType = "prazo" | "pagamento" | "alerta";
export type NotificationSeverity = "info" | "warn" | "danger";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  severity: NotificationSeverity;
  createdAt: Date;
}

const dayMs = 24 * 60 * 60 * 1000;

export function useNotifications() {
  const { demands } = useDemands();
  const { transactions } = useTransactions();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const computed = useMemo<AppNotification[]>(() => {
    const now = new Date();
    const list: AppNotification[] = [];

    // Demandas: prazos (status pendente, em_andamento, atrasada)
    demands.forEach((d) => {
      const deltaDays = Math.floor((new Date(d.dataEntrega).getTime() - now.getTime()) / dayMs);
      const isPend = d.status === "pendente" || d.status === "em_andamento" || d.status === "atrasada";
      if (!isPend) return;
      if (deltaDays <= 2) {
        list.push({
          id: `prazo-${d.id}`,
          title: `Prazo em ${deltaDays <= 0 ? "hoje" : `${deltaDays} dia(s)`}`,
          description: `${d.demanda} • ${d.responsavel}`,
          type: "prazo",
          severity: deltaDays < 0 || d.status === "atrasada" ? "danger" : "warn",
          createdAt: now,
        });
      }
    });

    // Pagamentos: inferir vencimento pelo mês/ano ou campo vencimento (dia do mês)
    transactions.forEach((t) => {
      if (t.tipo !== "entrada") return;
      const dueDay = t.vencimento ?? 5;
      const due = new Date(t.ano, t.mes - 1, dueDay);
      const delta = Math.floor((now.getTime() - due.getTime()) / dayMs);
      if (delta < 0) {
        if (delta >= -1) {
          list.push({
            id: `pag-hoje-${t.id}`,
            title: "Pagamento esperado",
            description: `${t.descricao} (vence em ${Math.abs(delta)} dia)`,
            type: "pagamento",
            severity: "info",
            createdAt: now,
          });
        }
      } else if (delta <= 5) {
        list.push({
          id: `pag-pendente-${t.id}`,
          title: "Pagamento pendente",
          description: `${t.descricao} (${delta} dia(s) após vencimento)`,
          type: "pagamento",
          severity: "warn",
          createdAt: now,
        });
      } else {
        list.push({
          id: `pag-atrasado-${t.id}`,
          title: "Pagamento atrasado",
          description: `${t.descricao} (${delta} dia(s) após vencimento)`,
          type: "pagamento",
          severity: "danger",
          createdAt: now,
        });
      }
    });

    return list;
  }, [demands, transactions]);

  useEffect(() => {
    setNotifications(computed);
  }, [computed]);

  const clearNotifications = () => setNotifications([]);

  return { notifications, clearNotifications };
}
