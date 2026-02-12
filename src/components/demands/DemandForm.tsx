import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DemandFormData, TaskItem, statusOptions, prioridadeOptions } from "@/types/demand";
import { useClients } from "@/contexts/ClientContext";
import { safeId } from "@/lib/safeId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Trash2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const demandSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente"),
  demanda: z.string().trim().min(3, "Demanda deve ter no mínimo 3 caracteres"),
  descricao: z.string().trim().optional(),
  dataPedido: z.date(),
  dataEntrega: z.date(),
  responsavel: z.string().trim().min(2, "Informe o responsável"),
  status: z.enum(["pendente", "em_andamento", "concluida", "atrasada"]),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
});

type DemandSchemaType = z.infer<typeof demandSchema>;

interface DemandFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DemandFormData) => Promise<void>;
  defaultValues?: Partial<DemandFormData>;
  isEdit?: boolean;
}

export function DemandForm({
  open,
  onClose,
  onSubmit,
  defaultValues,
  isEdit = false,
}: DemandFormProps) {
  const { toast } = useToast();
  const { clients } = useClients();
  const [tarefas, setTarefas] = useState<TaskItem[]>(defaultValues?.tarefas || []);
  const [novaTarefa, setNovaTarefa] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DemandSchemaType>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      clientId: defaultValues?.clientId || "",
      demanda: defaultValues?.demanda || "",
      descricao: defaultValues?.descricao || "",
      dataPedido: defaultValues?.dataPedido ? new Date(defaultValues.dataPedido) : new Date(),
      dataEntrega: defaultValues?.dataEntrega ? new Date(defaultValues.dataEntrega) : new Date(),
      responsavel: defaultValues?.responsavel || "",
      status: defaultValues?.status || "pendente",
      prioridade: defaultValues?.prioridade || "media",
    },
  });

  useEffect(() => {
    if (open) {
      setTarefas(defaultValues?.tarefas || []);
      setNovaTarefa("");
    }
  }, [defaultValues, open]);

  const handleFormSubmit = async (data: DemandSchemaType) => {
    const formData: DemandFormData = {
      clientId: data.clientId,
      demanda: data.demanda,
      descricao: data.descricao || "",
      dataPedido: data.dataPedido,
      dataEntrega: data.dataEntrega,
      responsavel: data.responsavel,
      status: data.status,
      prioridade: data.prioridade,
      tarefas,
    };
    await onSubmit(formData);
    toast({
      title: isEdit ? "Demanda atualizada!" : "Demanda criada!",
      description: data.demanda,
    });
    reset();
    setTarefas([]);
    onClose();
  };

  const addTarefa = () => {
    if (novaTarefa.trim()) {
      setTarefas([
        ...tarefas,
        { id: safeId("task"), titulo: novaTarefa.trim(), concluida: false },
      ]);
      setNovaTarefa("");
    }
  };

  const removeTarefa = (id: string) => {
    setTarefas(tarefas.filter((t) => t.id !== id));
  };

  const toggleTarefa = (id: string) => {
    setTarefas(
      tarefas.map((t) => (t.id === id ? { ...t, concluida: !t.concluida } : t))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {isEdit ? "Editar Demanda" : "Nova Demanda"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select
              value={watch("clientId")}
              onValueChange={(value) => setValue("clientId", value)}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && (
              <p className="text-sm text-destructive">{errors.clientId.message}</p>
            )}
          </div>

          {/* Demanda */}
          <div className="space-y-2">
            <Label htmlFor="demanda">Demanda *</Label>
            <Input
              id="demanda"
              placeholder="Título da demanda"
              {...register("demanda")}
              className="bg-secondary border-border"
            />
            {errors.demanda && (
              <p className="text-sm text-destructive">{errors.demanda.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Detalhes da demanda"
              {...register("descricao")}
              className="bg-secondary border-border min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Data Pedido */}
            <div className="space-y-2">
              <Label>Data do Pedido *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary border-border",
                      !watch("dataPedido") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch("dataPedido")
                      ? format(watch("dataPedido"), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("dataPedido")}
                    onSelect={(date) => date && setValue("dataPedido", date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data Entrega */}
            <div className="space-y-2">
              <Label>Data de Entrega *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-secondary border-border",
                      !watch("dataEntrega") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch("dataEntrega")
                      ? format(watch("dataEntrega"), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("dataEntrega")}
                    onSelect={(date) => date && setValue("dataEntrega", date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsável */}
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input
                id="responsavel"
                placeholder="Nome do responsável"
                {...register("responsavel")}
                className="bg-secondary border-border"
              />
              {errors.responsavel && (
                <p className="text-sm text-destructive">{errors.responsavel.message}</p>
              )}
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label>Prioridade *</Label>
              <Select
                value={watch("prioridade")}
                onValueChange={(value) => setValue("prioridade", value as any)}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {prioridadeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select
              value={watch("status")}
              onValueChange={(value) => setValue("status", value as any)}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checklist de Tarefas */}
          <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              <Label className="text-base font-medium">Checklist de Tarefas</Label>
            </div>

            {/* Add Task */}
            <div className="flex gap-2">
              <Input
                placeholder="Nova tarefa..."
                value={novaTarefa}
                onChange={(e) => setNovaTarefa(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTarefa())}
                className="bg-card border-border"
              />
              <Button type="button" size="icon" onClick={addTarefa}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Task List */}
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {tarefas.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex items-center justify-between p-2 rounded bg-card group"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={tarefa.concluida}
                      onCheckedChange={() => toggleTarefa(tarefa.id)}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        tarefa.concluida && "line-through text-muted-foreground"
                      )}
                    >
                      {tarefa.titulo}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => removeTarefa(tarefa.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
              {tarefas.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma tarefa adicionada
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{isEdit ? "Salvar" : "Criar Demanda"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
