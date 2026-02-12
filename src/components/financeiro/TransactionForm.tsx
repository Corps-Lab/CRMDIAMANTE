import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { meses, categorias, TransactionFormData } from "@/types/transaction";
import { useClients } from "@/contexts/ClientContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const transactionSchema = z.object({
  tipo: z.enum(["entrada", "despesa"]),
  descricao: z.string().trim().min(3, "Descrição deve ter no mínimo 3 caracteres"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2020).max(2030),
  vencimento: z.number().min(1).max(31).default(5),
  clientId: z.string().optional(),
});

type TransactionSchemaType = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => void;
  defaultMes?: number;
  defaultTipo?: "entrada" | "despesa";
}

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  defaultMes,
  defaultTipo = "entrada",
}: TransactionFormProps) {
  const { toast } = useToast();
  const { clients } = useClients();
  const currentYear = new Date().getFullYear();
  const defaultMonth = defaultMes || new Date().getMonth() + 1;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionSchemaType>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      tipo: defaultTipo,
      descricao: "",
      valor: 0,
      categoria: "",
      mes: defaultMonth,
      ano: currentYear,
      vencimento: 5,
      clientId: "",
    },
  });

  const tipo = watch("tipo");

  // Reaplica defaults toda vez que abrir ou mudar mês/tipo padrão
  useEffect(() => {
    if (open) {
      reset({
        tipo: defaultTipo,
        descricao: "",
        valor: 0,
        categoria: "",
        mes: defaultMonth,
        ano: currentYear,
        vencimento: 5,
        clientId: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultMes, defaultTipo]);

  const handleFormSubmit = (data: TransactionSchemaType) => {
    onSubmit(data as TransactionFormData);
    toast({
      title: data.tipo === "entrada" ? "Entrada registrada!" : "Despesa registrada!",
      description: `${data.descricao} - R$ ${data.valor.toFixed(2)}`,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Nova Transação
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setValue("tipo", "entrada")}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                tipo === "entrada"
                  ? "border-green-500 bg-green-500/10 text-green-400"
                  : "border-border bg-secondary text-muted-foreground hover:border-green-500/50"
              )}
            >
              <ArrowDownCircle className="w-5 h-5" />
              <span className="font-medium">Entrada</span>
            </button>
            <button
              type="button"
              onClick={() => setValue("tipo", "despesa")}
              className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                tipo === "despesa"
                  ? "border-red-500 bg-red-500/10 text-red-400"
                  : "border-border bg-secondary text-muted-foreground hover:border-red-500/50"
              )}
            >
              <ArrowUpCircle className="w-5 h-5" />
              <span className="font-medium">Despesa</span>
            </button>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              placeholder="Descrição da transação"
              {...register("descricao")}
              className="bg-secondary border-border"
            />
            {errors.descricao && (
              <p className="text-sm text-destructive">{errors.descricao.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                {...register("valor", { valueAsNumber: true })}
                className="bg-secondary border-border"
              />
              {errors.valor && (
                <p className="text-sm text-destructive">{errors.valor.message}</p>
              )}
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={watch("categoria")}
                onValueChange={(value) => setValue("categoria", value)}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias[tipo].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoria && (
                <p className="text-sm text-destructive">{errors.categoria.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Mês */}
            <div className="space-y-2">
              <Label>Mês *</Label>
              <Select
                value={String(watch("mes"))}
                onValueChange={(value) => setValue("mes", parseInt(value))}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ano */}
            <div className="space-y-2">
              <Label>Ano *</Label>
              <Select
                value={String(watch("ano"))}
                onValueChange={(value) => setValue("ano", parseInt(value))}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Vencimento */}
            <div className="space-y-2">
              <Label>Vencimento (dia)</Label>
              <Input
                id="vencimento"
                type="number"
                min="1"
                max="31"
                {...register("vencimento", { valueAsNumber: true })}
                className="bg-secondary border-border"
              />
            </div>

            {/* Cliente (opcional para entradas) */}
            {tipo === "entrada" && (
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <Select
                  value={watch("clientId") || ""}
                  onValueChange={(value) => setValue("clientId", value)}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Vincular a cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Registrar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
