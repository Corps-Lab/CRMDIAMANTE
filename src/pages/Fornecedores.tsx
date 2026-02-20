import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { SupplierTable } from "@/components/suppliers/SupplierTable";
import { SupplierDetails } from "@/components/suppliers/SupplierDetails";
import { useSuppliers } from "@/contexts/SupplierContext";
import { Supplier, SupplierFormData } from "@/types/supplier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Fornecedores() {
  const { suppliers, addSupplier, updateSupplier, removeSupplier, loading } = useSuppliers();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filtered = suppliers.filter((supplier) => {
    const term = search.toLowerCase();
    return (
      supplier.razaoSocial.toLowerCase().includes(term) ||
      supplier.documento.includes(search) ||
      supplier.responsavel.toLowerCase().includes(term)
    );
  });

  const handleSubmit = async (data: SupplierFormData) => {
    try {
      if (editing) {
        await updateSupplier(editing.id, data);
        toast({ title: "Fornecedor atualizado", description: data.razaoSocial });
        setEditing(null);
      } else {
        await addSupplier(data);
        toast({ title: "Fornecedor cadastrado", description: data.razaoSocial });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar fornecedor",
        description: err?.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditing(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <Truck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? "Carregando..." : `${suppliers.length} fornecedor${suppliers.length !== 1 ? "es" : ""} cadastrado${suppliers.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Fornecedor
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF/CNPJ ou responsável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        <div className="bg-card rounded-xl p-4 border border-border card-glow">
          <SupplierTable
            suppliers={filtered}
            onEdit={handleEdit}
            onDelete={removeSupplier}
            onView={setViewing}
          />
        </div>

        <SupplierForm
          open={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          defaultValues={
            editing
              ? {
                  razaoSocial: editing.razaoSocial,
                  docTipo: editing.docTipo,
                  documento: editing.documento,
                  endereco: editing.endereco,
                  responsavel: editing.responsavel,
                  contato: editing.contato,
                }
              : undefined
          }
          isEdit={!!editing}
        />

        <SupplierDetails supplier={viewing} open={!!viewing} onClose={() => setViewing(null)} />
      </div>
    </MainLayout>
  );
}
