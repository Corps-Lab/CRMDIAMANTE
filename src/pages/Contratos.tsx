import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ContractForm } from "@/components/contracts/ContractForm";
import { ContractTable } from "@/components/contracts/ContractTable";
import { ContractViewer } from "@/components/contracts/ContractViewer";
import { useContracts } from "@/contexts/ContractContext";
import { useClients } from "@/contexts/ClientContext";
import { Contract } from "@/types/contract";
import { ContractSchemaType } from "@/lib/contract-validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, Filter } from "lucide-react";

export default function Contratos() {
  const { contracts, addContract, removeContract, updateContract } = useContracts();
  const { totalFaturamento } = useClients();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      contract.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (data: ContractSchemaType) => {
    if (editingContract) {
      updateContract(editingContract.id, data);
      setEditingContract(null);
    } else {
      addContract(data);
    }
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingContract(null);
  };

  const activeContracts = contracts.filter((c) => c.status === "ativo").length;
  const totalContractValue = contracts
    .filter((c) => c.status === "ativo")
    .reduce((acc, c) => acc + c.valorContrato, 0);

  return (
    <MainLayout totalCaixa={totalFaturamento}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
              <p className="text-sm text-muted-foreground">
                {contracts.length} contrato{contracts.length !== 1 ? "s" : ""} • {activeContracts} ativo{activeContracts !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Contrato
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Total de Contratos</p>
            <p className="text-2xl font-bold text-foreground">{contracts.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Contratos Ativos</p>
            <p className="text-2xl font-bold text-primary">{activeContracts}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Valor Total (Ativos)</p>
            <p className="text-2xl font-bold text-primary">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totalContractValue)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="encerrado">Encerrados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl p-4 border border-border card-glow">
          <ContractTable
            contracts={filteredContracts}
            onEdit={handleEdit}
            onDelete={removeContract}
            onView={setViewingContract}
          />
        </div>

        {/* Form Modal */}
        <ContractForm
          open={isFormOpen}
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          defaultValues={
            editingContract
              ? {
                  clientId: editingContract.clientId,
                  titulo: editingContract.titulo,
                  valorContrato: editingContract.valorContrato,
                  recorrencia: editingContract.recorrencia,
                  dataInicio: new Date(editingContract.dataInicio),
                  dataFim: editingContract.dataFim ? new Date(editingContract.dataFim) : null,
                  status: editingContract.status,
                  conteudo: editingContract.conteudo,
                }
              : undefined
          }
          isEdit={!!editingContract}
        />

        {/* Viewer Modal */}
        <ContractViewer
          contract={viewingContract}
          open={!!viewingContract}
          onClose={() => setViewingContract(null)}
        />
      </div>
    </MainLayout>
  );
}
