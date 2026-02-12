import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Scale } from "lucide-react";

const weightSchema = z.object({
  weight: z
    .string()
    .min(1, "Peso é obrigatório")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0 && parseFloat(val) < 500, "Peso deve ser entre 0 e 500 kg"),
  bodyFatPercentage: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100),
      "Gordura corporal deve ser entre 0 e 100%"
    ),
  notes: z.string().max(500, "Máximo 500 caracteres").optional(),
});

type WeightFormData = z.infer<typeof weightSchema>;

interface AddWeightModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { weight: number; bodyFatPercentage?: number; notes?: string }) => void;
  isLoading?: boolean;
}

export const AddWeightModal: React.FC<AddWeightModalProps> = ({ open, onOpenChange, onSubmit, isLoading }) => {
  const form = useForm<WeightFormData>({
    resolver: zodResolver(weightSchema),
    defaultValues: { weight: "", bodyFatPercentage: "", notes: "" },
  });

  const resetDefaults = () => form.reset({ weight: "", bodyFatPercentage: "", notes: "" });

  const handleClose = () => {
    onOpenChange(false);
    resetDefaults();
  };

  const handleSubmit = (data: WeightFormData) => {
    onSubmit({
      weight: parseFloat(data.weight),
      bodyFatPercentage: data.bodyFatPercentage ? parseFloat(data.bodyFatPercentage) : undefined,
      notes: data.notes || undefined,
    });
    resetDefaults();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(value) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Registrar Peso
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso (kg) *</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="decimal" step="0.1" min="0" max="500" placeholder="Ex: 75.5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bodyFatPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>% Gordura Corporal (opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="decimal" step="0.1" min="0" max="100" placeholder="Ex: 18.5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Como você está se sentindo hoje?" className="resize-none" rows={3} maxLength={500} {...field} />
                  </FormControl>
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
