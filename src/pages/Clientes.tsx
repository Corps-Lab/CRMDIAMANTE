import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClientForm } from "@/components/clients/ClientForm";
import { ClientTable } from "@/components/clients/ClientTable";
import { ClientDetails } from "@/components/clients/ClientDetails";
import { useClients } from "@/contexts/ClientContext";
import { Client, ClientFormData } from "@/types/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Clientes() {
  const { clients, addClient, removeClient, updateClient, totalFaturamento, loading } = useClients();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const filteredClients = clients.filter(
    (client) =>
      client.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cnpj.includes(searchTerm) ||
      (client.cpf || "").includes(searchTerm) ||
      client.responsavel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (data: ClientFormData) => {
    try {
      if (editingClient) {
        await updateClient(editingClient.id, data);
        toast({ title: "Cliente atualizado", description: data.razaoSocial });
        setEditingClient(null);
      } else {
        await addClient(data);
        toast({ title: "Cliente cadastrado", description: data.razaoSocial });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar cliente",
        description: err?.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingClient(null);
  };

  return (
    <MainLayout totalCaixa={totalFaturamento}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? "Carregando..." : `${clients.length} cliente${clients.length !== 1 ? "s" : ""} cadastrado${clients.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl p-4 border border-border card-glow">
          <ClientTable
            clients={filteredClients}
            onEdit={handleEdit}
            onDelete={removeClient}
            onView={setViewingClient}
          />
        </div>

        {/* Form Modal */}
        <ClientForm
          open={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          defaultValues={
            editingClient
              ? {
                  razaoSocial: editingClient.razaoSocial,
                  cnpj: editingClient.cnpj,
                  cpf: editingClient.cpf || "",
                  endereco: editingClient.endereco,
                  valorPago: editingClient.valorPago,
                  recorrencia: editingClient.recorrencia,
                  responsavel: editingClient.responsavel,
                  contatoInterno: editingClient.contatoInterno,
                }
              : undefined
          }
          isEdit={!!editingClient}
        />

        {/* Details Modal */}
        <ClientDetails
          client={viewingClient}
          open={!!viewingClient}
          onClose={() => setViewingClient(null)}
        />
      </div>
    </MainLayout>
  );
}
