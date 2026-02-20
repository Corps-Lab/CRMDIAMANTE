import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { UnitForm } from "@/components/projects/UnitForm";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { UnitTable } from "@/components/projects/UnitTable";
import { useProjects } from "@/contexts/ProjectContext";
import { Project, Unit, ProjectFormData, UnitFormData } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building2, Hammer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Obras() {
  const { projects, units, loading, addProject, updateProject, removeProject, addUnit, updateUnit, removeUnit } = useProjects();
  const [isProjectFormOpen, setProjectFormOpen] = useState(false);
  const [isUnitFormOpen, setUnitFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filteredProjects = projects.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase()) || p.cidade.toLowerCase().includes(search.toLowerCase())
  );

  const handleProjectSubmit = async (data: ProjectFormData) => {
    try {
      if (editingProject) {
        await updateProject(editingProject.id, data);
        toast({ title: "Obra atualizada", description: data.nome });
        setEditingProject(null);
      } else {
        await addProject(data);
        toast({ title: "Obra cadastrada", description: data.nome });
      }
      setProjectFormOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar obra", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  };

  const handleUnitSubmit = async (data: UnitFormData) => {
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, data);
        toast({ title: "Unidade atualizada", description: data.nome });
        setEditingUnit(null);
      } else {
        await addUnit(data);
        toast({ title: "Unidade cadastrada", description: data.nome });
      }
      setUnitFormOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar unidade", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Obras</h1>
              <p className="text-sm text-muted-foreground">{loading ? "Carregando..." : `${projects.length} obra(s)`}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setProjectFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova Obra
            </Button>
            <Button variant="outline" onClick={() => setUnitFormOpen(true)} className="gap-2">
              <Hammer className="w-4 h-4" /> Nova Unidade
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Input
            placeholder="Buscar por obra ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-card border-border pl-3"
          />
        </div>

        <div className="bg-card rounded-xl p-4 border border-border card-glow">
          <ProjectTable
            projects={filteredProjects}
            onEdit={(p) => { setEditingProject(p); setProjectFormOpen(true); }}
            onDelete={removeProject}
            onView={() => {/* reuse edit modal; could expand later */}}
          />
        </div>

        <div className="bg-card rounded-xl p-4 border border-border card-glow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Unidades</h2>
            <span className="text-sm text-muted-foreground">{units.length} unidade(s)</span>
          </div>
          <UnitTable
            units={units}
            projects={projects}
            onEdit={(u) => { setEditingUnit(u); setUnitFormOpen(true); }}
            onDelete={removeUnit}
          />
        </div>

        <ProjectForm
          open={isProjectFormOpen}
          onClose={() => { setProjectFormOpen(false); setEditingProject(null); }}
          onSubmit={handleProjectSubmit}
          defaultValues={editingProject ? {
            nome: editingProject.nome,
            cidade: editingProject.cidade,
            inicioPrevisto: editingProject.inicioPrevisto,
            entregaPrevista: editingProject.entregaPrevista,
            status: editingProject.status,
            progresso: editingProject.progresso,
            orcamento: editingProject.orcamento,
            gasto: editingProject.gasto,
          } : undefined}
          isEdit={!!editingProject}
        />

        <UnitForm
          open={isUnitFormOpen}
          onClose={() => { setUnitFormOpen(false); setEditingUnit(null); }}
          onSubmit={handleUnitSubmit}
          defaultValues={editingUnit ? {
            projectId: editingUnit.projectId,
            nome: editingUnit.nome,
            area: editingUnit.area,
            preco: editingUnit.preco,
            status: editingUnit.status,
          } : undefined}
          projects={projects}
          isEdit={!!editingUnit}
        />
      </div>
    </MainLayout>
  );
}
