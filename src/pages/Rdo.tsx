import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProjects } from "@/contexts/ProjectContext";
import { useRdo } from "@/contexts/RdoContext";
import { RdoFormData } from "@/types/rdo";
import { rdoSchema, RdoSchemaType } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RdoPage() {
  const { projects } = useProjects();
  const { rdos, loading, addRdo, removeRdo } = useRdo();
  const [isFormOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const filtered = rdos.filter((r) => {
    const term = search.toLowerCase();
    const projName = projects.find((p) => p.id === r.projectId)?.nome || "";
    return projName.toLowerCase().includes(term) || r.atividades.toLowerCase().includes(term);
  });

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<RdoSchemaType>({
    resolver: zodResolver(rdoSchema),
    defaultValues: {
      projectId: projects[0]?.id || "",
      data: new Date().toISOString().slice(0,10),
      clima: "",
      equipe: "",
      horasTrabalhadas: 8,
      atividades: "",
      impedimentos: "",
      observacoes: "",
    },
  });

  const [files, setFiles] = useState<FileList | null>(null);

  const handleFormSubmit = async (data: RdoSchemaType) => {
    const payload: RdoFormData = { ...data, fotos: files };
    setUploadProgress(files ? { done: 0, total: files.length } : null);
    try {
      await addRdo(payload, (done, total) => setUploadProgress({ done, total }));
      toast({ title: "RDO salvo", description: new Date(data.data).toLocaleDateString("pt-BR") });
      reset();
      setFiles(null);
      setUploadProgress(null);
      setFormOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar RDO", description: err?.message || "Tente novamente", variant: "destructive" });
      setUploadProgress(null);
    }
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.nome || "Obra";

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <CalendarClock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Diário de Obra (RDO)</h1>
              <p className="text-sm text-muted-foreground">{loading ? "Carregando..." : `${rdos.length} registro(s)`}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por obra ou atividade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs bg-card border-border"
            />
            <Button onClick={() => setFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Novo RDO
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rdo) => (
            <Card key={rdo.id} className="border-border bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{projectName(rdo.projectId)}</span>
                  <Badge variant="outline">{new Date(rdo.data).toLocaleDateString("pt-BR")}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Equipe: {rdo.equipe}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Clima:</strong> {rdo.clima}</p>
                <p><strong className="text-foreground">Horas:</strong> {rdo.horasTrabalhadas}h</p>
                <p className="text-foreground whitespace-pre-wrap">{rdo.atividades}</p>
                {rdo.impedimentos && <p><strong className="text-destructive">Impedimentos:</strong> {rdo.impedimentos}</p>}
                {rdo.observacoes && <p><strong className="text-foreground">Obs.:</strong> {rdo.observacoes}</p>}
                {rdo.fotos && rdo.fotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {rdo.fotos.map((url, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setPreviewUrl(url)}
                        className="focus:outline-none"
                      >
                        <img key={idx} src={url} alt="foto RDO" className="h-20 w-full object-cover rounded" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-xs text-foreground">
                  <button className="text-primary" onClick={() => {/* editar futuro */}}>Editar</button>
                  <button className="text-destructive" onClick={() => removeRdo(rdo.id)}>Excluir</button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[640px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">Novo RDO</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Obra *</Label>
                  <select className="h-10 rounded-md border border-border bg-secondary px-3" {...register("projectId")}
                    defaultValue={projects[0]?.id || ""}
                    onChange={(e) => setValue("projectId", e.target.value)}
                  >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  {errors.projectId && <p className="text-sm text-destructive">{errors.projectId.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Data *</Label>
                  <Input type="date" {...register("data")}/>
                  {errors.data && <p className="text-sm text-destructive">{errors.data.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Clima *</Label>
                  <Input placeholder="Ensolarado, nublado..." {...register("clima")} />
                  {errors.clima && <p className="text-sm text-destructive">{errors.clima.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Equipe *</Label>
                  <Input placeholder="Empreiteira, Qtde, Frente" {...register("equipe")} />
                  {errors.equipe && <p className="text-sm text-destructive">{errors.equipe.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Horas trabalhadas *</Label>
                  <Input type="number" step="0.5" min="0" max="24" {...register("horasTrabalhadas", { valueAsNumber: true })} />
                  {errors.horasTrabalhadas && <p className="text-sm text-destructive">{errors.horasTrabalhadas.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Atividades *</Label>
                  <Input {...register("atividades")} placeholder="Resumo das frentes trabalhadas" />
                  {errors.atividades && <p className="text-sm text-destructive">{errors.atividades.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Impedimentos</Label>
                  <Input {...register("impedimentos")} placeholder="Bloqueios, clima, falta de material..." />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Observações</Label>
                  <Input {...register("observacoes")} placeholder="Observações gerais" />
                </div>
              <div className="md:col-span-2 space-y-1">
                  <Label>Fotos</Label>
                  <Input type="file" multiple accept="image/*" onChange={(e) => setFiles(e.target.files)} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>Salvar</Button>
              </div>
              {uploadProgress && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Upload: {uploadProgress.done}/{uploadProgress.total}
                  <div className="w-full bg-secondary/60 h-2 rounded mt-1">
                    <div
                      className="h-2 bg-primary rounded"
                      style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {previewUrl && (
          <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
            <DialogContent className="max-w-3xl">
              <img src={previewUrl} alt="Pré-visualização" className="w-full h-auto" />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}
