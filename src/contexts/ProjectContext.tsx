import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Project, ProjectFormData, Unit, UnitFormData } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useAgency } from "./AgencyContext";

interface ProjectContextType {
  projects: Project[];
  units: Unit[];
  loading: boolean;
  addProject: (data: ProjectFormData) => Promise<void>;
  updateProject: (id: string, data: ProjectFormData) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  addUnit: (data: UnitFormData) => Promise<void>;
  updateUnit: (id: string, data: UnitFormData) => Promise<void>;
  removeUnit: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { isIsolated, currentAgency } = useAgency();
  const storageKey = useMemo(() => `crm_${currentAgency.id}_projects`, [currentAgency.id]);
  const storageUnitsKey = useMemo(() => `crm_${currentAgency.id}_units`, [currentAgency.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!user || isIsolated) {
        try {
          const rawP = localStorage.getItem(storageKey);
          const rawU = localStorage.getItem(storageUnitsKey);
          setProjects(rawP ? JSON.parse(rawP) : []);
          setUnits(rawU ? JSON.parse(rawU) : []);
        } catch {
          setProjects([]);
          setUnits([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const { data: pData, error: pErr } = await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });
        if (pErr) throw pErr;
        const mappedP =
          pData?.map((p) => ({
            id: p.id,
            nome: p.nome,
            cidade: p.cidade,
            inicioPrevisto: p.inicio_previsto,
            entregaPrevista: p.entrega_prevista,
            status: p.status,
            progresso: Number(p.progresso || 0),
            orcamento: Number(p.orcamento || 0),
            gasto: Number(p.gasto || 0),
            createdAt: new Date(p.created_at),
          })) || [];
        setProjects(mappedP);

        const { data: uData, error: uErr } = await supabase
          .from("units")
          .select("*")
          .order("created_at", { ascending: false });
        if (uErr) throw uErr;
        const mappedU =
          uData?.map((u) => ({
            id: u.id,
            projectId: u.project_id,
            nome: u.nome,
            area: Number(u.area || 0),
            preco: Number(u.preco || 0),
            status: u.status,
          })) || [];
        setUnits(mappedU);
      } catch (err) {
        console.error("Erro ao carregar obras", err);
        setProjects([]);
        setUnits([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, isIsolated, storageKey, storageUnitsKey]);

  const persistLocal = (nextProjects: Project[], nextUnits: Unit[]) => {
    localStorage.setItem(storageKey, JSON.stringify(nextProjects));
    localStorage.setItem(storageUnitsKey, JSON.stringify(nextUnits));
    setProjects(nextProjects);
    setUnits(nextUnits);
  };

  const addProject = async (data: ProjectFormData) => {
    if (!user || isIsolated) {
      const newProject: Project = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      persistLocal([newProject, ...projects], units);
      return;
    }
    const { data: inserted, error } = await supabase
      .from("projects")
      .insert({
        nome: data.nome,
        cidade: data.cidade,
        inicio_previsto: data.inicioPrevisto,
        entrega_prevista: data.entregaPrevista,
        status: data.status,
        progresso: data.progresso,
        orcamento: data.orcamento,
        gasto: data.gasto,
      })
      .select()
      .single();
    if (error) throw error;
    const mapped: Project = {
      id: inserted.id,
      nome: inserted.nome,
      cidade: inserted.cidade,
      inicioPrevisto: inserted.inicio_previsto,
      entregaPrevista: inserted.entrega_prevista,
      status: inserted.status,
      progresso: Number(inserted.progresso || 0),
      orcamento: Number(inserted.orcamento || 0),
      gasto: Number(inserted.gasto || 0),
      createdAt: new Date(inserted.created_at),
    };
    setProjects((prev) => [mapped, ...prev]);
  };

  const updateProject = async (id: string, data: ProjectFormData) => {
    if (!user || isIsolated) {
      const nextP = projects.map((p) => (p.id === id ? { ...p, ...data } : p));
      persistLocal(nextP, units);
      return;
    }
    const { data: updated, error } = await supabase
      .from("projects")
      .update({
        nome: data.nome,
        cidade: data.cidade,
        inicio_previsto: data.inicioPrevisto,
        entrega_prevista: data.entregaPrevista,
        status: data.status,
        progresso: data.progresso,
        orcamento: data.orcamento,
        gasto: data.gasto,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              id: updated.id,
              nome: updated.nome,
              cidade: updated.cidade,
              inicioPrevisto: updated.inicio_previsto,
              entregaPrevista: updated.entrega_prevista,
              status: updated.status,
              progresso: Number(updated.progresso || 0),
              orcamento: Number(updated.orcamento || 0),
              gasto: Number(updated.gasto || 0),
              createdAt: new Date(updated.created_at),
            }
          : p
      )
    );
  };

  const removeProject = async (id: string) => {
    if (!user || isIsolated) {
      const nextP = projects.filter((p) => p.id !== id);
      const nextU = units.filter((u) => u.projectId !== id);
      persistLocal(nextP, nextU);
      return;
    }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setUnits((prev) => prev.filter((u) => u.projectId !== id));
  };

  const addUnit = async (data: UnitFormData) => {
    if (!user || isIsolated) {
      const newUnit: Unit = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        ...data,
      };
      const nextU = [newUnit, ...units];
      persistLocal(projects, nextU);
      return;
    }
    const { data: inserted, error } = await supabase
      .from("units")
      .insert({
        project_id: data.projectId,
        nome: data.nome,
        area: data.area,
        preco: data.preco,
        status: data.status,
      })
      .select()
      .single();
    if (error) throw error;
    const mapped: Unit = {
      id: inserted.id,
      projectId: inserted.project_id,
      nome: inserted.nome,
      area: Number(inserted.area || 0),
      preco: Number(inserted.preco || 0),
      status: inserted.status,
    };
    setUnits((prev) => [mapped, ...prev]);
  };

  const updateUnit = async (id: string, data: UnitFormData) => {
    if (!user || isIsolated) {
      const next = units.map((u) => (u.id === id ? { ...u, ...data } : u));
      persistLocal(projects, next);
      return;
    }
    const { data: updated, error } = await supabase
      .from("units")
      .update({
        project_id: data.projectId,
        nome: data.nome,
        area: data.area,
        preco: data.preco,
        status: data.status,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setUnits((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              id: updated.id,
              projectId: updated.project_id,
              nome: updated.nome,
              area: Number(updated.area || 0),
              preco: Number(updated.preco || 0),
              status: updated.status,
            }
          : u
      )
    );
  };

  const removeUnit = async (id: string) => {
    if (!user || isIsolated) {
      const next = units.filter((u) => u.id !== id);
      persistLocal(projects, next);
      return;
    }
    const { error } = await supabase.from("units").delete().eq("id", id);
    if (error) throw error;
    setUnits((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <ProjectContext.Provider
      value={{ projects, units, loading, addProject, updateProject, removeProject, addUnit, updateUnit, removeUnit }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectProvider");
  return ctx;
}
