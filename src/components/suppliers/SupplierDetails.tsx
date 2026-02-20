import { Supplier } from "@/types/supplier";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, MapPin, User, Phone, IdCard } from "lucide-react";

interface SupplierDetailsProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
}

export function SupplierDetails({ supplier, open, onClose }: SupplierDetailsProps) {
  if (!supplier) return null;

  const formatDate = (date: Date) => new Intl.DateTimeFormat("pt-BR").format(new Date(date));

  const details = [
    { icon: IdCard, label: "Documento", value: `${supplier.docTipo.toUpperCase()} — ${supplier.documento}` },
    { icon: MapPin, label: "Endereço", value: supplier.endereco },
    { icon: User, label: "Responsável", value: supplier.responsavel },
    { icon: Phone, label: "Contato", value: supplier.contato },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {supplier.razaoSocial}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Fornecedor desde {formatDate(supplier.createdAt)}</p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {details.map((detail, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
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
