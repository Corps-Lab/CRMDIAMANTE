import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dumbbell } from "lucide-react";

const strengthSchema = z.object({
  exerciseName: z.string().min(1, "Nome do exercício é obrigatório").max(100, "Máximo 100 caracteres"),
  initialWeight: z
    .string()
    .optional()
    .refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), "Peso deve ser um número válido"),
  currentWeight: z
    .string()
    .min(1, "Peso atual é obrigatório")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Peso deve ser um número válido"),
  unit: z.enum(["kg", "lb"]),
});

export type StrengthRecord = {
  id: string;
  exercise_name: string;
  initial_weight?: number | null;
  current_weight?: number | null;
  unit: string;
};

type StrengthFormData = z.infer<typeof strengthSchema>;

interface AddStrengthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { exerciseName: string; initialWeight?: number; currentWeight: number; unit: string }) => void;
  isLoading?: boolean;
  editingRecord?: StrengthRecord;
}

export const AddStrengthModal: React.FC<AddStrengthModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  editingRecord,
}) => {
  const form = useForm<StrengthFormData>({
    resolver: zodResolver(strengthSchema),
    defaultValues: {
      exerciseName: editingRecord?.exercise_name || "",
      initialWeight: editingRecord?.initial_weight?.toString() || "",
      currentWeight: editingRecord?.current_weight?.toString() || "",
      unit: (editingRecord?.unit as "kg" | "lb") || "kg",
    },
  });

  React.useEffect(() => {
    if (editingRecord) {
      form.reset({
        exerciseName: editingRecord.exercise_name,
        initialWeight: editingRecord.initial_weight?.toString() || "",
        currentWeight: editingRecord.current_weight?.toString() || "",
        unit: (editingRecord.unit as "kg" | "lb") || "kg",
      });
    } else {
      form.reset({ exerciseName: "", initialWeight: "", currentWeight: "", unit: "kg" });
    }
  }, [editingRecord, form]);

  const resetDefaults = () => form.reset({ exerciseName: "", initialWeight: "", currentWeight: "", unit: "kg" });

  const handleClose = () => {
    onOpenChange(false);
    resetDefaults();
  };

  const handleSubmit = (data: StrengthFormData) => {
    onSubmit({
      exerciseName: data.exerciseName.trim(),
      initialWeight: data.initialWeight ? parseFloat(data.initialWeight) : undefined,
      currentWeight: parseFloat(data.currentWeight),
      unit: data.unit,
    });
    resetDefaults();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(value) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            {editingRecord ? "Editar Recorde" : "Novo Recorde de Força"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="exerciseName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exercício *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Supino Reto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="initialWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Inicial</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="decimal" step="0.5" min="0" placeholder="Ex: 50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Atual *</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="decimal" step="0.5" min="0" placeholder="Ex: 65" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                      <SelectItem value="lb">Libras (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
