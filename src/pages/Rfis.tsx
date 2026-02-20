import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useRfi } from "@/contexts/RfiContext";
import { useProjects } from "@/contexts/ProjectContext";
import { Rfi, RfiFormData } from "@/types/rfi";
import { rfiSchema, RfiSchemaType } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusLabel: Record<Rfi["status"], string> = {
  aberto: "Aberto",
  respondido: "Respondido",
  fechado: "Fechado",
};

export default function Rfis() {
  const { rfis, loading, addRfi, updateRfi, removeRfi } = useRfi();
  const { projects } = useProjects();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Rfi | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filtered = rfis.filter((r) => {
    const term = search.toLowerCase();
    const projName = projects.find((p) => p.id === r.projectId)?.nome || "";
    return (
      r.titulo.toLowerCase().includes(term) ||
      projName.toLowerCase().includes(term) ||
      r.solicitante.toLowerCase().includes(term) ||
      r.responsavel.toLowerCase().includes(term)
    );
  });

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<RfiSchemaType>({
    resolver: zodResolver(rfiSchema),
    defaultValues: {
      projectId: projects[0]?.id || "",
      titulo: "",
      pergunta: "",
      solicitante: "",
      responsavel: "",
      prazo: "",
      status: "aberto",
      resposta: "",
    },
  });

  const handleFormSubmit = async (data: RfiFormData) => {
    try {
      if (editing) {
        await updateRfi(editing.id, data);
        toast({ title: "RFI atualizada", description: data.titulo });
        setEditing(null);
      } else {
        await addRfi(data);
        toast({ title: "RFI criada", description: data.titulo });
      }
      setFormOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: "Erro ao salvar RFI", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.nome || "Obra";

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">RFIs / Impedimentos</h1>
              <p className="text-sm text-muted-foreground">{loading ? "Carregando..." : `${rfis.length} RFI(s)`}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por título, obra ou responsável"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs bg-card border-border"
            />
            <Button onClick={() => setFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova RFI
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rfi) => (
            <Card key={rfi.id} className="border-border bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{rfi.titulo}</span>
                  <Badge variant="outline">{statusLabel[rfi.status]}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Obra: {projectName(rfi.projectId)}</p>
                <p className="text-xs text-muted-foreground">Responsável: {rfi.responsavel}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Pergunta:</strong> {rfi.pergunta}</p>
                {rfi.resposta && <p><strong className="text-foreground">Resposta:</strong> {rfi.resposta}</p>}
                <p><strong className="text-foreground">Prazo:</strong> {new Intl.DateTimeFormat("pt-BR").format(new Date(rfi.prazo))}</p>
                <p><strong className="text-foreground">Solicitante:</strong> {rfi.solicitante}</p>
                <div className="flex justify-between text-xs text-foreground">
                  <button className="text-primary" onClick={() => { setEditing(rfi); setFormOpen(true); setValue("status", rfi.status); }}>Editar</button>
                  <button className="text-destructive" onClick={() => removeRfi(rfi.id)}>Excluir</button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[620px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">{editing ? "Editar RFI" : "Nova RFI"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <Label>Título *</Label>
                  <Input {...register("titulo")} placeholder="Assunto da RFI" />
                  {errors.titulo && <p className="text-sm text-destructive">{errors.titulo.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Obra *</Label>
                  <select className="h-10 rounded-md border border-border bg-secondary px-3"
                    {...register("projectId")}
                    defaultValue={projects[0]?.id || ""}
                    onChange={(e) => setValue("projectId", e.target.value)}
                  >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  {errors.projectId && <p className="text-sm text-destructive">{errors.projectId.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Solicitante *</Label>
                  <Input {...register("solicitante")} placeholder="Quem abriu" />
                  {errors.solicitante && <p className="text-sm text-destructive">{errors.solicitante.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Responsável *</Label>
                  <Input {...register("responsavel")} placeholder="Quem deve responder" />
                  {errors.responsavel && <p className="text-sm text-destructive">{errors.responsavel.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Prazo *</Label>
                  <Input type="date" {...register("prazo")} />
                  {errors.prazo && <p className="text-sm text-destructive">{errors.prazo.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Status *</Label>
                  <select className="h-10 rounded-md border border-border bg-secondary px-3" {...register("status")}
                    defaultValue="aberto"
                  >
                    <option value="aberto">Aberto</option>
                    <option value="respondido">Respondido</option>
                    <option value="fechado">Fechado</option>
                  </select>
                  {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Pergunta *</Label>
                  <Input {...register("pergunta")} placeholder="Descreva o impedimento" />
                  {errors.pergunta && <p className="text-sm text-destructive">{errors.pergunta.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Resposta</Label>
                  <Input {...register("resposta")} placeholder="Resposta / orientação" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{editing ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
