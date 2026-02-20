import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useSales } from "@/contexts/SalesContext";
import { Lead, LeadFormData } from "@/types/sales";
import { leadSchema, LeadSchemaType } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FileSignature, ShieldCheck, DollarSign, MessageCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAgency } from "@/contexts/AgencyContext";
import { validateBrokerByCode } from "@/lib/brokerRegistry";
import { useContracts } from "@/contexts/ContractContext";
import { useTransactions } from "@/contexts/TransactionContext";
import { useClients } from "@/contexts/ClientContext";

const columns: { key: Lead["etapa"]; title: string }[] = [
  { key: "lead", title: "Lead" },
  { key: "proposta", title: "Proposta" },
  { key: "reserva", title: "Reserva" },
  { key: "contrato", title: "Contrato" },
];

export default function FunilVendas() {
  const {
    leads,
    addLead,
    moveLead,
    updateLead,
    removeLead,
    loading,
    commissionSettings,
    setCommissionPercent,
    registerSaleCommunication,
    saleCommunications,
  } = useSales();
  const { role, user } = useAuth();
  const { currentAgency, isIsolated } = useAgency();
  const { addContractFromSale, refresh: refreshContracts } = useContracts();
  const { addTransaction, refresh: refreshTransactions } = useTransactions();
  const { clients } = useClients();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [commissionDraft, setCommissionDraft] = useState(
    String(commissionSettings.percentual),
  );
  const [saleLeadId, setSaleLeadId] = useState("");
  const [saleLeadName, setSaleLeadName] = useState("");
  const [saleUnidade, setSaleUnidade] = useState("");
  const [saleValue, setSaleValue] = useState("");
  const [saleBrokerName, setSaleBrokerName] = useState("");
  const [saleBrokerCpf, setSaleBrokerCpf] = useState("");
  const [saleBrokerCreci, setSaleBrokerCreci] = useState("");
  const [saleBrokerCode, setSaleBrokerCode] = useState("");

  const filtered = leads.filter((l) =>
    l.nomeCliente.toLowerCase().includes(search.toLowerCase()) ||
    l.contato.toLowerCase().includes(search.toLowerCase()) ||
    (l.unidade || "").toLowerCase().includes(search.toLowerCase())
  );

  const byStage = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      items: filtered.filter((l) => l.etapa === col.key),
    }));
  }, [filtered]);

  const canManageCommission = role === "ceo" || role === "financeiro";
  const canManageWhatsAppLead = role === "ceo" || role === "financeiro" || role === "vendas";
  const whatsappWebhookUrl = useMemo(() => {
    try {
      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
      if (!supabaseUrl) return "";
      const host = new URL(supabaseUrl).hostname;
      const projectRef = host.split(".")[0];
      if (!projectRef) return "";
      return `https://${projectRef}.functions.supabase.co/whatsapp-gateway`;
    } catch {
      return "";
    }
  }, []);
  const parsedSaleValue = Number(String(saleValue || "0").replace(",", "."));
  const commissionPreview =
    Number.isFinite(parsedSaleValue) && parsedSaleValue > 0
      ? (parsedSaleValue * commissionSettings.percentual) / 100
      : 0;

  useEffect(() => {
    setCommissionDraft(String(commissionSettings.percentual));
  }, [commissionSettings.percentual]);

  useEffect(() => {
    if (!saleLeadId) return;
    const selectedLead = leads.find((lead) => lead.id === saleLeadId);
    if (!selectedLead) return;
    setSaleLeadName(selectedLead.nomeCliente);
    setSaleUnidade(selectedLead.unidade || "");
    setSaleValue(selectedLead.valor > 0 ? String(selectedLead.valor) : "");
    if (!saleBrokerName && selectedLead.corretor) {
      setSaleBrokerName(selectedLead.corretor);
    }
  }, [saleLeadId, leads, saleBrokerName]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadSchemaType>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      nomeCliente: "",
      contato: "",
      origem: "",
      etapa: "lead",
      valor: 0,
      unidade: "",
      corretor: "",
      observacoes: "",
    },
  });

  const handleFormSubmit = async (data: LeadFormData) => {
    try {
      if (editing) {
        await updateLead(editing.id, data);
        toast({ title: "Lead atualizado", description: data.nomeCliente });
        setEditing(null);
      } else {
        await addLead(data);
        toast({ title: "Lead adicionado", description: data.nomeCliente });
      }
      setFormOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: "Erro ao salvar lead", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  };

  const handleCardDrop = async (lead: Lead, etapa: Lead["etapa"]) => {
    if (lead.etapa === etapa) return;
    await moveLead(lead.id, etapa);
  };

  const startEditingLead = (lead: Lead) => {
    setEditing(lead);
    setValue("nomeCliente", lead.nomeCliente);
    setValue("contato", lead.contato);
    setValue("origem", lead.origem);
    setValue("etapa", lead.etapa);
    setValue("valor", lead.valor);
    setValue("unidade", lead.unidade || "");
    setValue("corretor", lead.corretor || "");
    setValue("observacoes", lead.observacoes || "");
    setFormOpen(true);
  };

  const handleCommissionSave = async () => {
    const parsed = Number(commissionDraft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast({
        title: "Percentual inválido",
        description: "Informe um percentual entre 0 e 100.",
        variant: "destructive",
      });
      return;
    }
    try {
      await setCommissionPercent(parsed, user?.email || null);
      toast({
        title: "Comissão atualizada",
        description: `Novo percentual: ${parsed.toFixed(2)}%`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar comissão",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSaleCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorVenda = Number(String(saleValue || "0").replace(",", "."));
    if (!saleLeadName.trim()) {
      toast({
        title: "Cliente obrigatório",
        description: "Informe o cliente da venda comunicada.",
        variant: "destructive",
      });
      return;
    }
    if (!Number.isFinite(valorVenda) || valorVenda <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor de venda maior que zero.",
        variant: "destructive",
      });
      return;
    }
    if (!saleBrokerCpf.trim() || !saleBrokerCode.trim()) {
      toast({
        title: "Dados do corretor incompletos",
        description: "CPF e código do corretor são obrigatórios para comunicar venda.",
        variant: "destructive",
      });
      return;
    }

    let brokerNameForSave = saleBrokerName.trim();
    if (isIsolated || !user) {
      const brokerValidation = validateBrokerByCode(currentAgency.id, {
        brokerCode: saleBrokerCode,
        cpf: saleBrokerCpf,
        creci: saleBrokerCreci,
      });

      if (!brokerValidation.ok) {
        toast({
          title: "Validação do corretor falhou",
          description: brokerValidation.message,
          variant: "destructive",
        });
        return;
      }
      brokerNameForSave = brokerNameForSave || brokerValidation.broker.nome;
    }

    try {
      const communication = await registerSaleCommunication({
        leadId: saleLeadId || null,
        leadNomeCliente: saleLeadName,
        unidade: saleUnidade || null,
        valorVenda,
        brokerNome: brokerNameForSave || "Corretor não informado",
        brokerCpf: saleBrokerCpf,
        brokerCreci: saleBrokerCreci,
        brokerCode: saleBrokerCode,
        registradoPor: user?.email || null,
        autoCreateContract: true,
        autoCreateFinance: true,
      });

      // Em modo local, replicamos o pipeline completo sem depender de backend.
      if (isIsolated || !user) {
        const matchedClient = clients.find(
          (client) =>
            client.razaoSocial.trim().toLowerCase() ===
            saleLeadName.trim().toLowerCase(),
        );
        await addContractFromSale({
          clientId: matchedClient?.id || null,
          clientName: matchedClient?.razaoSocial || saleLeadName.trim(),
          titulo: `Contrato - ${saleLeadName.trim()}`,
          valorContrato: valorVenda,
          saleCommunicationId: communication.id,
          status: "pendente",
        });

        const now = new Date();
        const mes = now.getMonth() + 1;
        const ano = now.getFullYear();
        await addTransaction({
          tipo: "entrada",
          descricao: `Venda comunicada - ${saleLeadName.trim()}`,
          valor: valorVenda,
          categoria: "Venda",
          mes,
          ano,
          vencimento: now.getDate(),
          clientId: matchedClient?.id,
          payerType: "cliente",
          referenciaNome: matchedClient?.razaoSocial || saleLeadName.trim(),
          originSaleId: communication.id,
          originType: "venda",
        });
        await addTransaction({
          tipo: "despesa",
          descricao: `Comissão corretor - ${brokerNameForSave || "Corretor"}`,
          valor: communication.valorComissao,
          categoria: "Comissão Corretor",
          mes,
          ano,
          vencimento: now.getDate(),
          payerType: "colaborador",
          referenciaNome: brokerNameForSave || "Corretor",
          originSaleId: communication.id,
          originType: "comissao",
        });
      } else {
        await Promise.all([refreshContracts(), refreshTransactions()]);
      }

      toast({
        title: "Venda comunicada com sucesso",
        description:
          `Comissão calculada: R$ ${communication.valorComissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` +
          ". Contrato e lançamentos financeiros gerados automaticamente.",
      });

      setSaleLeadId("");
      setSaleLeadName("");
      setSaleUnidade("");
      setSaleValue("");
      setSaleBrokerName("");
      setSaleBrokerCpf("");
      setSaleBrokerCreci("");
      setSaleBrokerCode("");
    } catch (err: any) {
      toast({
        title: "Erro ao comunicar venda",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <FileSignature className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Funil de Vendas</h1>
              <p className="text-sm text-muted-foreground">{loading ? "Carregando..." : `${leads.length} lead(s)`}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input
              placeholder="Buscar por cliente, contato ou unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs bg-card border-border"
            />
            <Button onClick={() => setFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Lead
            </Button>
          </div>
        </div>

        {canManageWhatsAppLead && (
          <Card className="border-border bg-card/90">
            <CardContent className="pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  Leads de anúncio via WhatsApp
                </p>
                <p className="text-xs text-muted-foreground">
                  Configure este webhook no Meta para cadastrar leads automaticamente no funil.
                </p>
                <p className="text-xs font-mono break-all text-primary/90">
                  {whatsappWebhookUrl || "Defina VITE_SUPABASE_URL para gerar o endpoint."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={async () => {
                  if (!whatsappWebhookUrl) return;
                  await navigator.clipboard.writeText(whatsappWebhookUrl);
                  toast({
                    title: "Webhook copiado",
                    description: "URL pronta para configurar no Meta WhatsApp Cloud.",
                  });
                }}
              >
                <Copy className="w-4 h-4" />
                Copiar webhook
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {byStage.map((col) => (
            <Card key={col.key} className="border-border bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{col.title}</span>
                  <span className="text-xs text-muted-foreground">{col.items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[220px]">
                {col.items.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2 shadow-sm"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("lead-id", lead.id);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleCardDrop(lead, col.key);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground leading-tight">{lead.nomeCliente}</p>
                        <p className="text-xs text-muted-foreground">{lead.origem}</p>
                      </div>
                      <span className="text-xs font-semibold text-primary">R$ {lead.valor.toLocaleString("pt-BR")}</span>
                    </div>
                    {lead.unidade && <p className="text-xs text-muted-foreground">Unidade: {lead.unidade}</p>}
                    <p className="text-xs text-muted-foreground">Contato: {lead.contato}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <button className="text-primary" onClick={() => startEditingLead(lead)}>
                        Editar
                      </button>
                      <button className="text-destructive" onClick={() => removeLead(lead.id)}>Excluir</button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {canManageCommission && (
            <Card className="xl:col-span-1 border-border bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Comissão do corretor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Percentual atual (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={commissionDraft}
                    onChange={(e) => setCommissionDraft(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Apenas CEO e Financeiro podem alterar esta configuração.
                </p>
                <Button className="w-full" onClick={handleCommissionSave}>
                  Salvar percentual
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className={canManageCommission ? "xl:col-span-2 border-border bg-card/90" : "xl:col-span-3 border-border bg-card/90"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Comunicar venda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSaleCommunication}>
                <div className="space-y-1 md:col-span-2">
                  <Label>Lead (opcional)</Label>
                  <select
                    className="h-10 rounded-md border border-border bg-secondary px-3"
                    value={saleLeadId}
                    onChange={(e) => setSaleLeadId(e.target.value)}
                  >
                    <option value="">Selecionar lead</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.nomeCliente} {lead.unidade ? `- ${lead.unidade}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Cliente da venda *</Label>
                  <Input
                    value={saleLeadName}
                    onChange={(e) => setSaleLeadName(e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unidade</Label>
                  <Input
                    value={saleUnidade}
                    onChange={(e) => setSaleUnidade(e.target.value)}
                    placeholder="Ex: Torre B - 402"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Valor da venda (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saleValue}
                    onChange={(e) => setSaleValue(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nome do corretor</Label>
                  <Input
                    value={saleBrokerName}
                    onChange={(e) => setSaleBrokerName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1">
                  <Label>CPF do corretor *</Label>
                  <Input
                    value={saleBrokerCpf}
                    onChange={(e) => setSaleBrokerCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-1">
                  <Label>CRECI (se houver)</Label>
                  <Input
                    value={saleBrokerCreci}
                    onChange={(e) => setSaleBrokerCreci(e.target.value)}
                    placeholder="Ex: 123456-F"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Código único do corretor *</Label>
                  <Input
                    value={saleBrokerCode}
                    onChange={(e) => setSaleBrokerCode(e.target.value)}
                    placeholder="COR-000XXXX"
                  />
                </div>
                <div className="md:col-span-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                  Comissão aplicada: <span className="font-semibold text-foreground">{commissionSettings.percentual.toFixed(2)}%</span>
                  {" · "}
                  Valor estimado: <span className="font-semibold text-primary">R$ {commissionPreview.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">Comunicar venda</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vendas comunicadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {saleCommunications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda comunicada ainda.</p>
            ) : (
              saleCommunications.slice(0, 12).map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{item.leadNomeCliente}</p>
                      <p className="text-xs text-muted-foreground">
                        Corretor: {item.brokerNome} · Código: {item.brokerCode}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-primary">
                        Comissão: R$ {item.valorComissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Venda: R$ {item.valorVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[540px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">{editing ? "Editar lead" : "Novo lead"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cliente *</Label>
                  <Input {...register("nomeCliente")} placeholder="Nome do cliente" />
                  {errors.nomeCliente && <p className="text-sm text-destructive">{errors.nomeCliente.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Contato *</Label>
                  <Input {...register("contato")} placeholder="Telefone ou email" />
                  {errors.contato && <p className="text-sm text-destructive">{errors.contato.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Origem *</Label>
                  <Input {...register("origem")} placeholder="Indicação, site, evento..." />
                  {errors.origem && <p className="text-sm text-destructive">{errors.origem.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" {...register("valor", { valueAsNumber: true })} />
                  {errors.valor && <p className="text-sm text-destructive">{errors.valor.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Unidade</Label>
                  <Input {...register("unidade")} placeholder="Torre A - 1201" />
                </div>
                <div className="space-y-1">
                  <Label>Corretor</Label>
                  <Input {...register("corretor")} placeholder="Nome do corretor" />
                </div>
                <div className="space-y-1">
                  <Label>Etapa</Label>
                  <select
                    className="h-10 rounded-md border border-border bg-secondary px-3"
                    {...register("etapa")}
                    defaultValue="lead"
                  >
                    <option value="lead">Lead</option>
                    <option value="proposta">Proposta</option>
                    <option value="reserva">Reserva</option>
                    <option value="contrato">Contrato</option>
                  </select>
                  {errors.etapa && <p className="text-sm text-destructive">{errors.etapa.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Observações</Label>
                  <Input {...register("observacoes")} placeholder="Notas rápidas" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{editing ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
