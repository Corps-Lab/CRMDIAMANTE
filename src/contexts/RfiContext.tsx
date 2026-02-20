import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Rfi, RfiFormData } from "@/types/rfi";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";

interface RfiContextType {
  rfis: Rfi[];
  loading: boolean;
  addRfi: (data: RfiFormData) => Promise<void>;
  updateRfi: (id: string, data: RfiFormData) => Promise<void>;
  removeRfi: (id: string) => Promise<void>;
}

const RfiContext = createContext<RfiContextType | undefined>(undefined);

export function RfiProvider({ children }: { children: ReactNode }) {
  const [rfis, setRfis] = useState<Rfi[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_rfis`, [currentAgency.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!user || isIsolated) {
        try {
          const raw = localStorage.getItem(storageKey);
          setRfis(raw ? JSON.parse(raw) : []);
        } catch {
          setRfis([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.from("rfis").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        const mapped =
          data?.map((r) => ({
            id: r.id,
            projectId: r.project_id,
            titulo: r.titulo,
            pergunta: r.pergunta,
            solicitante: r.solicitante,
            responsavel: r.responsavel,
            prazo: r.prazo,
            status: r.status,
            resposta: r.resposta,
            createdAt: new Date(r.created_at),
          })) || [];
        setRfis(mapped);
      } catch (err) {
        console.error("Erro ao carregar RFIs", err);
        setRfis([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isIsolated, storageKey]);

  const persistLocal = (next: Rfi[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setRfis(next);
  };

  const addRfi = async (data: RfiFormData) => {
    if (!user || isIsolated) {
      const newRfi: Rfi = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      persistLocal([newRfi, ...rfis]);
      return;
    }
    const { data: inserted, error } = await supabase
      .from("rfis")
      .insert({
        project_id: data.projectId,
        titulo: data.titulo,
        pergunta: data.pergunta,
        solicitante: data.solicitante,
        responsavel: data.responsavel,
        prazo: data.prazo,
        status: data.status,
        resposta: data.resposta,
      })
      .select()
      .single();
    if (error) throw error;
    const mapped: Rfi = {
      id: inserted.id,
      projectId: inserted.project_id,
      titulo: inserted.titulo,
      pergunta: inserted.pergunta,
      solicitante: inserted.solicitante,
      responsavel: inserted.responsavel,
      prazo: inserted.prazo,
      status: inserted.status,
      resposta: inserted.resposta,
      createdAt: new Date(inserted.created_at),
    };
    setRfis((prev) => [mapped, ...prev]);
  };

  const updateRfi = async (id: string, data: RfiFormData) => {
    if (!user || isIsolated) {
      const next = rfis.map((r) => (r.id === id ? { ...r, ...data } : r));
      persistLocal(next);
      return;
    }
    const { data: updated, error } = await supabase
      .from("rfis")
      .update({
        project_id: data.projectId,
        titulo: data.titulo,
        pergunta: data.pergunta,
        solicitante: data.solicitante,
        responsavel: data.responsavel,
        prazo: data.prazo,
        status: data.status,
        resposta: data.resposta,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setRfis((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              id: updated.id,
              projectId: updated.project_id,
              titulo: updated.titulo,
              pergunta: updated.pergunta,
              solicitante: updated.solicitante,
              responsavel: updated.responsavel,
              prazo: updated.prazo,
              status: updated.status,
              resposta: updated.resposta,
              createdAt: new Date(updated.created_at),
            }
          : r
      )
    );
  };

  const removeRfi = async (id: string) => {
    if (!user || isIsolated) {
      persistLocal(rfis.filter((r) => r.id !== id));
      return;
    }
    const { error } = await supabase.from("rfis").delete().eq("id", id);
    if (error) throw error;
    setRfis((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <RfiContext.Provider value={{ rfis, loading, addRfi, updateRfi, removeRfi }}>
      {children}
    </RfiContext.Provider>
  );
}

export function useRfi() {
  const ctx = useContext(RfiContext);
  if (!ctx) throw new Error("useRfi must be used within a RfiProvider");
  return ctx;
}
