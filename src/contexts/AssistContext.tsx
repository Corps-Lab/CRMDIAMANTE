import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Ticket, TicketFormData } from "@/types/assistencia";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";

interface AssistContextType {
  tickets: Ticket[];
  loading: boolean;
  addTicket: (data: TicketFormData) => Promise<Ticket>;
  updateTicket: (id: string, data: TicketFormData) => Promise<void>;
  removeTicket: (id: string) => Promise<void>;
}

const AssistContext = createContext<AssistContextType | undefined>(undefined);

export function AssistProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_tickets`, [currentAgency.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!user || isIsolated) {
        try {
          const raw = localStorage.getItem(storageKey);
          setTickets(raw ? JSON.parse(raw) : []);
        } catch {
          setTickets([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("tickets")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped =
          data?.map((t) => ({
            id: t.id,
            unidade: t.unidade,
            cliente: t.cliente,
            contato: t.contato,
            tipo: t.tipo,
            status: t.status,
            prazo: t.prazo,
            descricao: t.descricao,
            responsavel: t.responsavel,
            createdAt: new Date(t.created_at),
          })) || [];
        setTickets(mapped);
      } catch (err) {
        console.error("Erro ao carregar tickets", err);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isIsolated, storageKey]);

  const persistLocal = (next: Ticket[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setTickets(next);
  };

  const addTicket = async (data: TicketFormData) => {
    if (!user || isIsolated) {
      const newTicket: Ticket = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      persistLocal([newTicket, ...tickets]);
      return newTicket;
    }
    const { data: inserted, error } = await supabase
      .from("tickets")
      .insert({
        unidade: data.unidade,
        cliente: data.cliente,
        contato: data.contato,
        tipo: data.tipo,
        status: data.status,
        prazo: data.prazo,
        descricao: data.descricao,
        responsavel: data.responsavel,
      })
      .select()
      .single();
    if (error) throw error;
    const mapped: Ticket = {
      id: inserted.id,
      unidade: inserted.unidade,
      cliente: inserted.cliente,
      contato: inserted.contato,
      tipo: inserted.tipo,
      status: inserted.status,
      prazo: inserted.prazo,
      descricao: inserted.descricao,
      responsavel: inserted.responsavel,
      createdAt: new Date(inserted.created_at),
    };
    setTickets((prev) => [mapped, ...prev]);
    return mapped;
  };

  const updateTicket = async (id: string, data: TicketFormData) => {
    if (!user || isIsolated) {
      const next = tickets.map((t) => (t.id === id ? { ...t, ...data } : t));
      persistLocal(next);
      return;
    }
    const { data: updated, error } = await supabase
      .from("tickets")
      .update({
        unidade: data.unidade,
        cliente: data.cliente,
        contato: data.contato,
        tipo: data.tipo,
        status: data.status,
        prazo: data.prazo,
        descricao: data.descricao,
        responsavel: data.responsavel,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              id: updated.id,
              unidade: updated.unidade,
              cliente: updated.cliente,
              contato: updated.contato,
              tipo: updated.tipo,
              status: updated.status,
              prazo: updated.prazo,
              descricao: updated.descricao,
              responsavel: updated.responsavel,
              createdAt: new Date(updated.created_at),
            }
          : t
      )
    );
  };

  const removeTicket = async (id: string) => {
    if (!user || isIsolated) {
      persistLocal(tickets.filter((t) => t.id !== id));
      return;
    }
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) throw error;
    setTickets((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <AssistContext.Provider value={{ tickets, loading, addTicket, updateTicket, removeTicket }}>
      {children}
    </AssistContext.Provider>
  );
}

export function useAssist() {
  const ctx = useContext(AssistContext);
  if (!ctx) throw new Error("useAssist must be used within an AssistProvider");
  return ctx;
}
