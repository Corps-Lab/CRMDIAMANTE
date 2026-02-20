import { useState } from "react";
import { Contract, contractStatusOptions } from "@/types/contract";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Trash2, Eye, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ContractTableProps {
  contracts: Contract[];
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
  onView: (contract: Contract) => void;
}

export function ContractTable({ contracts, onEdit, onDelete, onView }: ContractTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const recorrenciaLabel: Record<string, string> = {
    unico: "Único",
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };

  const getStatusStyle = (status: string) => {
    return contractStatusOptions.find((s) => s.value === status)?.color || "";
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg">Nenhum contrato cadastrado</p>
        <p className="text-muted-foreground text-sm mt-1">
          Clique em "Novo Contrato" para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-muted-foreground font-semibold">Título</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Cliente</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Valor</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Recorrência</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Vigência</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
              <TableHead className="text-muted-foreground font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract, index) => (
              <TableRow
                key={contract.id}
                className={cn(
                  "transition-colors hover:bg-secondary/30",
                  index % 2 === 0 ? "bg-card" : "bg-card/50"
                )}
              >
                <TableCell className="font-medium text-foreground">
                  {contract.titulo}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contract.clientName.length > 25 
                    ? contract.clientName.substring(0, 25) + "..." 
                    : contract.clientName}
                </TableCell>
                <TableCell className="text-primary font-semibold">
                  {formatCurrency(contract.valorContrato)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {recorrenciaLabel[contract.recorrencia]}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(contract.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                  {contract.dataFim && (
                    <> - {format(new Date(contract.dataFim), "dd/MM/yyyy", { locale: ptBR })}</>
                  )}
                </TableCell>
                <TableCell>
                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium", getStatusStyle(contract.status))}>
                    {contractStatusOptions.find((s) => s.value === contract.status)?.label}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(contract)}
                      className="hover:text-primary"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(contract)}
                      className="hover:text-primary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(contract.id)}
                      className="hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
