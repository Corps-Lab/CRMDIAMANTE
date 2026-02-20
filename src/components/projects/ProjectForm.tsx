import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, ProjectSchemaType } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectSchemaType) => void;
  defaultValues?: ProjectSchemaType;
  isEdit?: boolean;
}

export function ProjectForm({ open, onClose, onSubmit, defaultValues, isEdit = false }: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProjectSchemaType>({
    resolver: zodResolver(projectSchema),
    defaultValues: defaultValues || {
      nome: "",
      cidade: "",
      inicioPrevisto: "",
      entregaPrevista: "",
      status: "planejamento",
      progresso: 0,
      orcamento: 0,
      gasto: 0,
    },
  });

  const handleFormSubmit = (data: ProjectSchemaType) => {
    onSubmit(data);
    reset();
    onClose();
  };

  const progresso = watch("progresso");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {isEdit ? "Editar Obra" : "Nova Obra"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Nome da Obra *</Label>
              <Input placeholder="Residencial Diamante" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Cidade *</Label>
              <Input placeholder="Cidade/UF" {...register("cidade")} />
              {errors.cidade && <p className="text-sm text-destructive">{errors.cidade.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={watch("status")}
                onValueChange={(v) => setValue("status", v as ProjectSchemaType["status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejamento">Planejamento</SelectItem>
                  <SelectItem value="em_obra">Em obra</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Início previsto *</Label>
              <Input type="date" {...register("inicioPrevisto")} />
              {errors.inicioPrevisto && <p className="text-sm text-destructive">{errors.inicioPrevisto.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Entrega prevista *</Label>
              <Input type="date" {...register("entregaPrevista")} />
              {errors.entregaPrevista && <p className="text-sm text-destructive">{errors.entregaPrevista.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Progresso (%)</Label>
              <div className="flex items-center gap-4">
                <Slider value={[progresso]} max={100} step={1} onValueChange={(v) => setValue("progresso", v[0] ?? 0)} />
                <span className="text-sm text-muted-foreground w-12 text-right">{progresso}%</span>
              </div>
              {errors.progresso && <p className="text-sm text-destructive">{errors.progresso.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Orçamento (R$)</Label>
              <Input type="number" step="0.01" min="0" {...register("orcamento", { valueAsNumber: true })} />
              {errors.orcamento && <p className="text-sm text-destructive">{errors.orcamento.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Gasto acumulado (R$)</Label>
              <Input type="number" step="0.01" min="0" {...register("gasto", { valueAsNumber: true })} />
              {errors.gasto && <p className="text-sm text-destructive">{errors.gasto.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isEdit ? "Salvar" : "Cadastrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
