import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, ClientSchemaType } from "@/lib/validations";
import { recorrenciaOptions } from "@/types/client";
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
import { X } from "lucide-react";

interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ClientSchemaType) => void;
  defaultValues?: ClientSchemaType;
  isEdit?: boolean;
}

export function ClientForm({
  open,
  onClose,
  onSubmit,
  defaultValues,
  isEdit = false,
}: ClientFormProps) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientSchemaType>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaultValues || {
      razaoSocial: "",
      cnpj: "",
      cpf: "",
      endereco: "",
      valorPago: 0,
      recorrencia: "mensal",
      responsavel: "",
      contatoInterno: "",
    },
  });

  const handleFormSubmit = (data: ClientSchemaType) => {
    onSubmit(data);
    toast({
      title: isEdit ? "Cliente atualizado!" : "Cliente cadastrado!",
      description: `${data.razaoSocial} foi ${isEdit ? "atualizado" : "adicionado"} com sucesso.`,
    });
    reset();
    onClose();
  };

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 14);
    return cleaned
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})(\d{2})$/, "$1-$2");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {isEdit ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Razão Social */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="razaoSocial">Razão Social *</Label>
              <Input
                id="razaoSocial"
                placeholder="Nome da empresa"
                {...register("razaoSocial")}
                className="bg-secondary border-border"
              />
              {errors.razaoSocial && (
                <p className="text-sm text-destructive">{errors.razaoSocial.message}</p>
              )}
            </div>

            {/* CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                {...register("cnpj")}
                onChange={(e) => {
                  const formatted = formatCNPJ(e.target.value);
                  setValue("cnpj", formatted);
                }}
                className="bg-secondary border-border"
              />
              {errors.cnpj && (
                <p className="text-sm text-destructive">{errors.cnpj.message}</p>
              )}
            </div>

            {/* CPF */}
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF (opcional)</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                {...register("cpf")}
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value);
                  setValue("cpf", formatted);
                }}
                className="bg-secondary border-border"
              />
              {errors.cpf && (
                <p className="text-sm text-destructive">{errors.cpf.message}</p>
              )}
            </div>

            {/* Valor Pago */}
            <div className="space-y-2">
              <Label htmlFor="valorPago">Valor Pago (R$) *</Label>
              <Input
                id="valorPago"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register("valorPago", { valueAsNumber: true })}
                className="bg-secondary border-border"
              />
              {errors.valorPago && (
                <p className="text-sm text-destructive">{errors.valorPago.message}</p>
              )}
            </div>

            {/* Endereço */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="endereco">Endereço *</Label>
              <Input
                id="endereco"
                placeholder="Rua, número, bairro, cidade/UF"
                {...register("endereco")}
                className="bg-secondary border-border"
              />
              {errors.endereco && (
                <p className="text-sm text-destructive">{errors.endereco.message}</p>
              )}
            </div>

            {/* Recorrência */}
            <div className="space-y-2">
              <Label>Recorrência de Pagamento *</Label>
              <Select
                value={watch("recorrencia")}
                onValueChange={(value) =>
                  setValue("recorrencia", value as ClientSchemaType["recorrencia"])
                }
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {recorrenciaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.recorrencia && (
                <p className="text-sm text-destructive">{errors.recorrencia.message}</p>
              )}
            </div>

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

            {/* Contato Interno */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="contatoInterno">Contato Interno *</Label>
              <Input
                id="contatoInterno"
                placeholder="Telefone ou email"
                {...register("contatoInterno")}
                className="bg-secondary border-border"
              />
              {errors.contatoInterno && (
                <p className="text-sm text-destructive">{errors.contatoInterno.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
