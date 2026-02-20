import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { RdoEntry, RdoFormData, RdoProgressFn } from "@/types/rdo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";
import { nanoid } from "nanoid";

interface RdoContextType {
  rdos: RdoEntry[];
  loading: boolean;
  addRdo: (data: RdoFormData, onProgress?: RdoProgressFn) => Promise<void>;
  removeRdo: (id: string) => Promise<void>;
}

const RdoContext = createContext<RdoContextType | undefined>(undefined);

export function RdoProvider({ children }: { children: ReactNode }) {
  const [rdos, setRdos] = useState<RdoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
const storageKey = useMemo(() => `crm_${currentAgency.id}_rdos`, [currentAgency.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!user || isIsolated) {
        try {
          const raw = localStorage.getItem(storageKey);
          setRdos(raw ? JSON.parse(raw) : []);
        } catch {
          setRdos([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.from("rdos").select("*").order("data", { ascending: false });
        if (error) throw error;
        const mapped =
          data?.map((r) => ({
            id: r.id,
            projectId: r.project_id,
            data: r.data,
            clima: r.clima,
            equipe: r.equipe,
            horasTrabalhadas: Number(r.horas_trabalhadas || 0),
            atividades: r.atividades,
            impedimentos: r.impedimentos,
            observacoes: r.observacoes,
            fotos: r.fotos || [],
            createdAt: new Date(r.created_at),
          })) || [];
        setRdos(mapped);
      } catch (err) {
        console.error("Erro ao carregar RDOs", err);
        setRdos([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isIsolated, storageKey]);

  const persistLocal = (next: RdoEntry[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setRdos(next);
  };

  const uploadPhotosLocal = async (files: FileList | null, onProgress?: RdoProgressFn) => {
    if (!files) return [] as string[];
    const urls: string[] = [];
    const list = Array.from(files);
    let done = 0;
    for (const file of list) {
      const reader = new FileReader();
      const url: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      urls.push(url);
      done += 1;
      onProgress?.(done, list.length);
    }
    return urls;
  };

  const uploadPhotosSupabase = async (files: FileList | null, projectId: string, onProgress?: RdoProgressFn) => {
    if (!files) return [] as string[];
    const bucket = supabase.storage.from("rdo-fotos");
    const urls: string[] = [];
    const list = Array.from(files);
    let done = 0;
    for (const file of list) {
      const path = `${projectId}/${Date.now()}-${nanoid(6)}-${file.name}`;
      const { error } = await bucket.upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = bucket.getPublicUrl(path);
      urls.push(data.publicUrl);
      done += 1;
      onProgress?.(done, list.length);
    }
    return urls;
  };

  const addRdo = async (data: RdoFormData, onProgress?: RdoProgressFn) => {
    const photoUrls = !user || isIsolated
      ? await uploadPhotosLocal(data.fotos || null, onProgress)
      : await uploadPhotosSupabase(data.fotos || null, data.projectId, onProgress);
    if (!user || isIsolated) {
      const newRdo: RdoEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        projectId: data.projectId,
        data: data.data,
        clima: data.clima,
        equipe: data.equipe,
        horasTrabalhadas: data.horasTrabalhadas,
        atividades: data.atividades,
        impedimentos: data.impedimentos ?? null,
        observacoes: data.observacoes ?? null,
        fotos: photoUrls,
        createdAt: new Date(),
      };
      persistLocal([newRdo, ...rdos]);
      return;
    }

    const { data: inserted, error } = await supabase
      .from("rdos")
      .insert({
        project_id: data.projectId,
        data: data.data,
        clima: data.clima,
        equipe: data.equipe,
        horas_trabalhadas: data.horasTrabalhadas,
        atividades: data.atividades,
        impedimentos: data.impedimentos,
        observacoes: data.observacoes,
        fotos: photoUrls,
      })
      .select()
      .single();
    if (error) throw error;
    const mapped: RdoEntry = {
      id: inserted.id,
      projectId: inserted.project_id,
      data: inserted.data,
      clima: inserted.clima,
      equipe: inserted.equipe,
      horasTrabalhadas: Number(inserted.horas_trabalhadas || 0),
      atividades: inserted.atividades,
      impedimentos: inserted.impedimentos,
      observacoes: inserted.observacoes,
      fotos: inserted.fotos || [],
      createdAt: new Date(inserted.created_at),
    };
    setRdos((prev) => [mapped, ...prev]);
  };

  const removeRdo = async (id: string) => {
    if (!user || isIsolated) {
      persistLocal(rdos.filter((r) => r.id !== id));
      return;
    }
    const { error } = await supabase.from("rdos").delete().eq("id", id);
    if (error) throw error;
    setRdos((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <RdoContext.Provider value={{ rdos, loading, addRdo, removeRdo }}>
      {children}
    </RdoContext.Provider>
  );
}

export function useRdo() {
  const ctx = useContext(RdoContext);
  if (!ctx) throw new Error("useRdo must be used within a RdoProvider");
  return ctx;
}
