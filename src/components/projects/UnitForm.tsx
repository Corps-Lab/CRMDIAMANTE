import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { unitSchema, UnitSchemaType } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Project } from "@/types/project";

interface UnitFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UnitSchemaType) => void;
  defaultValues?: UnitSchemaType;
  isEdit?: boolean;
  projects: Project[];
}

export function UnitForm({ open, onClose, onSubmit, defaultValues, isEdit = false, projects }: UnitFormProps) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting }, reset, watch } = useForm<UnitSchemaType>({
    resolver: zodResolver(unitSchema),
    defaultValues: defaultValues || {
      projectId: projects[0]?.id || "",
      nome: "",
      area: 0,
      preco: 0,
      status: "disponivel",
    },
  });

  const handleFormSubmit = (data: UnitSchemaType) => {
    onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {isEdit ? "Editar Unidade" : "Nova Unidade"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Obra *</Label>
              <Select value={watch("projectId")}
                onValueChange={(v) => setValue("projectId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projectId && <p className="text-sm text-destructive">{errors.projectId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Input placeholder="Torre A - 1201" {...register("nome")} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Área (m²)</Label>
              <Input type="number" step="0.01" min="0" {...register("area", { valueAsNumber: true })} />
              {errors.area && <p className="text-sm text-destructive">{errors.area.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" min="0" {...register("preco", { valueAsNumber: true })} />
              {errors.preco && <p className="text-sm text-destructive">{errors.preco.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={watch("status")}
                onValueChange={(v) => setValue("status", v as UnitSchemaType["status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
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
