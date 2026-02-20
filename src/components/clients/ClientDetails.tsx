import { Client } from "@/types/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, MapPin, DollarSign, Calendar, User, Phone } from "lucide-react";

interface ClientDetailsProps {
  client: Client | null;
  open: boolean;
  onClose: () => void;
}

export function ClientDetails({ client, open, onClose }: ClientDetailsProps) {
  if (!client) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
  };

  const recorrenciaLabel: Record<string, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };

  const details = [
    { icon: Building2, label: "CNPJ", value: client.cnpj },
    client.cpf ? { icon: Building2, label: "CPF", value: client.cpf } : null,
    { icon: MapPin, label: "Endereço", value: client.endereco },
    { icon: DollarSign, label: "Valor Pago", value: formatCurrency(client.valorPago) },
    { icon: Calendar, label: "Recorrência", value: recorrenciaLabel[client.recorrencia] },
    { icon: User, label: "Responsável", value: client.responsavel },
    { icon: Phone, label: "Contato Interno", value: client.contatoInterno },
  ].filter(Boolean) as { icon: any; label: string; value: string | number }[];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {client.razaoSocial}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cliente desde {formatDate(client.createdAt)}
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {details.map((detail, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
              <detail.icon className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">{detail.label}</p>
                <p className="text-foreground font-medium">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
