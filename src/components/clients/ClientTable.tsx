import { useState } from "react";
import { Client } from "@/types/client";
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
import { Edit2, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onView: (client: Client) => void;
}

export function ClientTable({ clients, onEdit, onDelete, onView }: ClientTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const recorrenciaLabel: Record<string, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground text-lg">Nenhum cliente cadastrado</p>
        <p className="text-muted-foreground text-sm mt-1">
          Clique em "Novo Cliente" para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-muted-foreground font-semibold">Razão Social</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Documentos</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Responsável</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Valor</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Recorrência</TableHead>
              <TableHead className="text-muted-foreground font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, index) => (
              <TableRow
                key={client.id}
                className={cn(
                  "transition-colors hover:bg-secondary/30",
                  index % 2 === 0 ? "bg-card" : "bg-card/50"
                )}
              >
                <TableCell className="font-medium text-foreground">
                  {client.razaoSocial}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col">
                    <span>{client.cnpj}</span>
                    {client.cpf && <span className="text-xs text-muted-foreground">CPF: {client.cpf}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{client.responsavel}</TableCell>
                <TableCell className="text-primary font-semibold">
                  {formatCurrency(client.valorPago)}
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {recorrenciaLabel[client.recorrencia]}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(client)}
                      className="hover:text-primary"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(client)}
                      className="hover:text-primary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(client.id)}
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
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
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
