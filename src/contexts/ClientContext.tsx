import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Client, ClientFormData } from "@/types/client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";

interface ClientContextType {
  clients: Client[];
  loading: boolean;
  addClient: (data: ClientFormData) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  updateClient: (id: string, data: ClientFormData) => Promise<void>;
  totalFaturamento: number;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_clients`, [currentAgency.id]);

  // Carrega clientes do Supabase
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Modo isolado ou sem login → usar storage local separado por agência
      if (!user || isIsolated) {
        try {
          const raw = localStorage.getItem(storageKey);
          const parsed: Client[] = raw ? JSON.parse(raw) : [];
          setClients(parsed);
        } catch {
          setClients([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped =
          data?.map((c) => ({
            id: c.id,
            razaoSocial: c.razao_social,
            cnpj: c.cnpj,
            endereco: c.endereco || "",
            valorPago: Number(c.valor_pago || 0),
            recorrencia: c.recorrencia,
            responsavel: c.responsavel || "",
            contatoInterno: c.contato_interno || "",
            cpf: c.cpf || null,
            createdAt: new Date(c.created_at),
          })) || [];
        setClients(mapped);
      } catch (err) {
        console.error("Erro ao carregar clientes", err);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isIsolated, storageKey]);

  const addClient = async (data: ClientFormData) => {
    // Modo mock: apenas grava localmente
    if (!user || isIsolated) {
      const newClient: Client = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        razaoSocial: data.razaoSocial,
        cnpj: data.cnpj,
        endereco: data.endereco,
        valorPago: data.valorPago,
        recorrencia: data.recorrencia,
        responsavel: data.responsavel,
        contatoInterno: data.contatoInterno,
        cpf: data.cpf || null,
        createdAt: new Date(),
      };
      setClients((prev) => {
        const next = [newClient, ...prev];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }

    const { data: inserted, error } = await supabase
      .from("clients")
      .insert({
        razao_social: data.razaoSocial,
        cnpj: data.cnpj,
        endereco: data.endereco,
        valor_pago: data.valorPago,
        recorrencia: data.recorrencia,
        responsavel: data.responsavel,
        contato_interno: data.contatoInterno,
        cpf: data.cpf,
      })
      .select()
      .single();
    if (error) throw error;
    const mapped: Client = {
      id: inserted.id,
      razaoSocial: inserted.razao_social,
      cnpj: inserted.cnpj,
      endereco: inserted.endereco || "",
      valorPago: Number(inserted.valor_pago || 0),
      recorrencia: inserted.recorrencia,
      responsavel: inserted.responsavel || "",
      contatoInterno: inserted.contato_interno || "",
      cpf: inserted.cpf || null,
      createdAt: new Date(inserted.created_at),
    };
    setClients((prev) => [mapped, ...prev]);
  };

  const removeClient = async (id: string) => {
    if (!user || isIsolated) {
      setClients((prev) => {
        const next = prev.filter((client) => client.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
    setClients((prev) => prev.filter((client) => client.id !== id));
  };

  const updateClient = async (id: string, data: ClientFormData) => {
    if (!user || isIsolated) {
      setClients((prev) => {
        const next = prev.map((client) =>
          client.id === id
            ? {
                ...client,
                razaoSocial: data.razaoSocial,
                cnpj: data.cnpj,
                cpf: data.cpf || null,
                endereco: data.endereco,
                valorPago: data.valorPago,
                recorrencia: data.recorrencia,
                responsavel: data.responsavel,
                contatoInterno: data.contatoInterno,
              }
            : client
        );
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return;
    }

    const { data: updated, error } = await supabase
      .from("clients")
      .update({
        razao_social: data.razaoSocial,
        cnpj: data.cnpj,
        endereco: data.endereco,
        valor_pago: data.valorPago,
        recorrencia: data.recorrencia,
        responsavel: data.responsavel,
        contato_interno: data.contatoInterno,
        cpf: data.cpf,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setClients((prev) =>
      prev.map((client) =>
        client.id === id
          ? {
              id: updated.id,
              razaoSocial: updated.razao_social,
              cnpj: updated.cnpj,
              endereco: updated.endereco || "",
              valorPago: Number(updated.valor_pago || 0),
              recorrencia: updated.recorrencia,
              responsavel: updated.responsavel || "",
              contatoInterno: updated.contato_interno || "",
              cpf: updated.cpf || null,
              createdAt: new Date(updated.created_at),
            }
          : client
      )
    );
  };

  const totalFaturamento = clients.reduce((acc, client) => {
    const multiplier: Record<string, number> = {
      // Novas formas de pagamento (tratadas como valor informado do negócio)
      a_vista: 1,
      parcelado: 1,
      boleto: 1,
      financiamento: 1,
      consorcio: 1,
      permuta: 1,
      // Compatibilidade com cadastros antigos
      mensal: 1,
      trimestral: 1 / 3,
      semestral: 1 / 6,
      anual: 1 / 12,
    };
    return acc + client.valorPago * (multiplier[client.recorrencia] ?? 1);
  }, 0);

  return (
    <ClientContext.Provider
      value={{ clients, loading, addClient, removeClient, updateClient, totalFaturamento }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClients() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error("useClients must be used within a ClientProvider");
  }
  return context;
}
