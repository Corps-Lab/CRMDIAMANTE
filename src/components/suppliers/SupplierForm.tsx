import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supplierSchema, SupplierSchemaType } from "@/lib/validations";
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

interface SupplierFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierSchemaType) => void;
  defaultValues?: SupplierSchemaType;
  isEdit?: boolean;
}

export function SupplierForm({ open, onClose, onSubmit, defaultValues, isEdit = false }: SupplierFormProps) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierSchemaType>({
    resolver: zodResolver(supplierSchema),
    defaultValues: defaultValues || {
      razaoSocial: "",
      docTipo: "cnpj",
      documento: "",
      endereco: "",
      responsavel: "",
      contato: "",
    },
  });

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})(\d{2})$/, "$1-$2");
  };

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 14);
    return cleaned
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const handleFormSubmit = (data: SupplierSchemaType) => {
    onSubmit(data);
    toast({
      title: isEdit ? "Fornecedor atualizado!" : "Fornecedor cadastrado!",
      description: `${data.razaoSocial} foi ${isEdit ? "atualizado" : "adicionado"}.`,
    });
    reset();
    onClose();
  };

  const docTipo = watch("docTipo");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="razaoSocial">Nome / Razão Social *</Label>
              <Input
                id="razaoSocial"
                placeholder="Fornecedor Ltda"
                {...register("razaoSocial")}
                className="bg-secondary border-border"
              />
              {errors.razaoSocial && (
                <p className="text-sm text-destructive">{errors.razaoSocial.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select
                value={docTipo}
                onValueChange={(val) => setValue("docTipo", val as SupplierSchemaType["docTipo"])}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="CPF ou CNPJ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                </SelectContent>
              </Select>
              {errors.docTipo && (
                <p className="text-sm text-destructive">{errors.docTipo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento">Documento *</Label>
              <Input
                id="documento"
                placeholder={docTipo === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                {...register("documento")}
                onChange={(e) => {
                  const formatted = docTipo === "cpf" ? formatCPF(e.target.value) : formatCNPJ(e.target.value);
                  setValue("documento", formatted);
                }}
                className="bg-secondary border-border"
              />
              {errors.documento && (
                <p className="text-sm text-destructive">{errors.documento.message}</p>
              )}
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input
                id="responsavel"
                placeholder="Nome do contato principal"
                {...register("responsavel")}
                className="bg-secondary border-border"
              />
              {errors.responsavel && (
                <p className="text-sm text-destructive">{errors.responsavel.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato">Contato *</Label>
              <Input
                id="contato"
                placeholder="Telefone ou email"
                {...register("contato")}
                className="bg-secondary border-border"
              />
              {errors.contato && (
                <p className="text-sm text-destructive">{errors.contato.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
