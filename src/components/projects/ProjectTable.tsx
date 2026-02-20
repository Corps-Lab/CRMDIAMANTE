import { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Edit2, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectTableProps {
  projects: Project[];
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onView: (project: Project) => void;
}

export function ProjectTable({ projects, onEdit, onDelete, onView }: ProjectTableProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-muted-foreground">Nenhuma obra cadastrada.</p>
        <p className="text-sm text-muted-foreground">Clique em "Nova Obra" para começar.</p>
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const statusLabel: Record<Project["status"], string> = {
    planejamento: "Planejamento",
    em_obra: "Em obra",
    entregue: "Entregue",
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50 hover:bg-secondary/50">
            <TableHead>Obra</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Orçamento</TableHead>
            <TableHead>Gasto</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p, index) => (
            <TableRow key={p.id} className={cn(index % 2 === 0 ? "bg-card" : "bg-card/50")}
            >
              <TableCell className="font-medium text-foreground">{p.nome}</TableCell>
              <TableCell>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  {statusLabel[p.status]}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.cidade}</TableCell>
              <TableCell className="min-w-[160px]">
                <div className="flex items-center gap-2">
                  <Progress value={p.progresso} className="h-2" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{p.progresso}%</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatCurrency(p.orcamento)}</TableCell>
              <TableCell className="text-muted-foreground">{formatCurrency(p.gasto)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onView(p)} className="hover:text-primary">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(p)} className="hover:text-primary">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)} className="hover:text-destructive">
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
