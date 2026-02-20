import { Unit, Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnitTableProps {
  units: Unit[];
  projects: Project[];
  onEdit: (unit: Unit) => void;
  onDelete: (id: string) => void;
}

export function UnitTable({ units, projects, onEdit, onDelete }: UnitTableProps) {
  if (units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <p className="text-muted-foreground">Nenhuma unidade cadastrada.</p>
      </div>
    );
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.nome || "-";

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50 hover:bg-secondary/50">
            <TableHead>Unidade</TableHead>
            <TableHead>Obra</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((u, index) => (
            <TableRow key={u.id} className={cn(index % 2 === 0 ? "bg-card" : "bg-card/50")}
            >
              <TableCell className="font-medium text-foreground">{u.nome}</TableCell>
              <TableCell className="text-muted-foreground">{projectName(u.projectId)}</TableCell>
              <TableCell className="text-muted-foreground">{u.area} m²</TableCell>
              <TableCell className="text-muted-foreground">{formatCurrency(u.preco)}</TableCell>
              <TableCell>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary capitalize">
                  {u.status}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(u)} className="hover:text-primary">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(u.id)} className="hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
