import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Supplier, SupplierFormData } from "@/types/supplier";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";

interface SupplierContextType {
  suppliers: Supplier[];
  loading: boolean;
  addSupplier: (data: SupplierFormData) => Promise<void>;
  updateSupplier: (id: string, data: SupplierFormData) => Promise<void>;
  removeSupplier: (id: string) => Promise<void>;
}

const SupplierContext = createContext<SupplierContextType | undefined>(undefined);

export function SupplierProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_suppliers`, [currentAgency.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!user || isIsolated) {
        try {
          const raw = localStorage.getItem(storageKey);
          const parsed: Supplier[] = raw ? JSON.parse(raw) : [];
          setSuppliers(parsed);
        } catch {
          setSuppliers([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("suppliers")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped =
          data?.map((s) => ({
            id: s.id,
            razaoSocial: s.razao_social,
            docTipo: s.doc_tipo,
            documento: s.documento,
            endereco: s.endereco || "",
            responsavel: s.responsavel || "",
            contato: s.contato || "",
            createdAt: new Date(s.created_at),
          })) || [];
        setSuppliers(mapped);
      } catch (err) {
        console.error("Erro ao carregar fornecedores", err);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isIsolated, storageKey]);

  const persistLocal = (next: Supplier[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSuppliers(next);
  };

  const addSupplier = async (data: SupplierFormData) => {
    if (!user || isIsolated) {
      const newSupplier: Supplier = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      persistLocal([newSupplier, ...suppliers]);
      return;
    }

    const { data: inserted, error } = await supabase
      .from("suppliers")
      .insert({
        razao_social: data.razaoSocial,
        doc_tipo: data.docTipo,
        documento: data.documento,
        endereco: data.endereco,
        responsavel: data.responsavel,
        contato: data.contato,
      })
      .select()
      .single();
    if (error) throw error;
    const mapped: Supplier = {
      id: inserted.id,
      razaoSocial: inserted.razao_social,
      docTipo: inserted.doc_tipo,
      documento: inserted.documento,
      endereco: inserted.endereco || "",
      responsavel: inserted.responsavel || "",
      contato: inserted.contato || "",
      createdAt: new Date(inserted.created_at),
    };
    setSuppliers((prev) => [mapped, ...prev]);
  };

  const updateSupplier = async (id: string, data: SupplierFormData) => {
    if (!user || isIsolated) {
      const next = suppliers.map((s) => (s.id === id ? { ...s, ...data } : s));
      persistLocal(next);
      return;
    }

    const { data: updated, error } = await supabase
      .from("suppliers")
      .update({
        razao_social: data.razaoSocial,
        doc_tipo: data.docTipo,
        documento: data.documento,
        endereco: data.endereco,
        responsavel: data.responsavel,
        contato: data.contato,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              id: updated.id,
              razaoSocial: updated.razao_social,
              docTipo: updated.doc_tipo,
              documento: updated.documento,
              endereco: updated.endereco || "",
              responsavel: updated.responsavel || "",
              contato: updated.contato || "",
              createdAt: new Date(updated.created_at),
            }
          : s
      )
    );
  };

  const removeSupplier = async (id: string) => {
    if (!user || isIsolated) {
      const next = suppliers.filter((s) => s.id !== id);
      persistLocal(next);
      return;
    }

    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <SupplierContext.Provider
      value={{ suppliers, loading, addSupplier, updateSupplier, removeSupplier }}
    >
      {children}
    </SupplierContext.Provider>
  );
}

export function useSuppliers() {
  const ctx = useContext(SupplierContext);
  if (!ctx) throw new Error("useSuppliers must be used within a SupplierProvider");
  return ctx;
}
