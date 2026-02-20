import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAssist } from "@/contexts/AssistContext";
import { Ticket, TicketFormData } from "@/types/assistencia";
import { ticketSchema, TicketSchemaType } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendAssistenciaWhatsApp } from "@/lib/whatsapp";

const statusLabel: Record<Ticket["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const tipoLabel: Record<Ticket["tipo"], string> = {
  hidraulica: "Hidráulica",
  eletrica: "Elétrica",
  acabamento: "Acabamento",
  estrutura: "Estrutura",
  outros: "Outros",
};

export default function Assistencia() {
  const { tickets, addTicket, updateTicket, removeTicket, loading } = useAssist();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filtered = tickets.filter((t) =>
    t.cliente.toLowerCase().includes(search.toLowerCase()) ||
    t.unidade.toLowerCase().includes(search.toLowerCase()) ||
    t.tipo.toLowerCase().includes(search.toLowerCase())
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TicketSchemaType>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      unidade: "",
      cliente: "",
      contato: "",
      tipo: "acabamento",
      status: "aberto",
      prazo: "",
      descricao: "",
      responsavel: "",
    },
  });

  const handleSubmitForm = async (data: TicketFormData) => {
    try {
      if (editing) {
        await updateTicket(editing.id, data);
        toast({ title: "Chamado atualizado", description: data.cliente });
        setEditing(null);
      } else {
        await addTicket(data);
        toast({ title: "Chamado criado", description: data.cliente });
      }
      setFormOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: "Erro ao salvar chamado", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  };

  const handleSendWhatsApp = async (ticket: Ticket) => {
    setSendingTicketId(ticket.id);
    try {
      const result = await sendAssistenciaWhatsApp({
        ticketId: ticket.id,
        phone: ticket.contato,
        targetName: ticket.cliente,
        status: statusLabel[ticket.status],
        description: ticket.descricao,
      });

      toast({
        title: "Mensagem enviada no WhatsApp",
        description: result.simulated
          ? "Integração em modo simulado. Clique para abrir no WhatsApp."
          : "Cliente notificado com sucesso.",
      });

      if (result.simulated && result.fallbackUrl) {
        window.open(result.fallbackUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      toast({
        title: "Falha no envio via WhatsApp",
        description: err?.message || "Verifique o contato e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSendingTicketId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Assistência Técnica</h1>
              <p className="text-sm text-muted-foreground">{loading ? "Carregando..." : `${tickets.length} chamado(s)`}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input
              placeholder="Buscar por cliente, unidade ou tipo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs bg-card border-border"
            />
            <Button onClick={() => setFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Novo chamado
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="border-border bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{t.cliente}</span>
                  <Badge variant={t.status === "concluido" ? "default" : "outline"}>{statusLabel[t.status]}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Unidade: {t.unidade}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Tipo:</strong> {tipoLabel[t.tipo]}</p>
                <p><strong className="text-foreground">Prazo:</strong> {new Intl.DateTimeFormat("pt-BR").format(new Date(t.prazo))}</p>
                <p><strong className="text-foreground">Responsável:</strong> {t.responsavel || "—"}</p>
                <p className="text-foreground">{t.descricao}</p>
                <div className="flex justify-between text-xs text-foreground">
                  <div className="flex items-center gap-3">
                    <button className="text-primary" onClick={() => { setEditing(t); setFormOpen(true); }}>Editar</button>
                    <button
                      className="text-primary inline-flex items-center gap-1"
                      onClick={() => handleSendWhatsApp(t)}
                      disabled={sendingTicketId === t.id}
                    >
                      <MessageCircle className="w-3 h-3" />
                      {sendingTicketId === t.id ? "Enviando..." : "WhatsApp"}
                    </button>
                  </div>
                  <button className="text-destructive" onClick={() => removeTicket(t.id)}>Excluir</button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[560px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">{editing ? "Editar chamado" : "Novo chamado"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Unidade *</Label>
                  <Input {...register("unidade")} placeholder="Torre A - 1201" />
                  {errors.unidade && <p className="text-sm text-destructive">{errors.unidade.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Cliente *</Label>
                  <Input {...register("cliente")} placeholder="Nome do cliente" />
                  {errors.cliente && <p className="text-sm text-destructive">{errors.cliente.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Contato *</Label>
                  <Input {...register("contato")} placeholder="Telefone ou email" />
                  {errors.contato && <p className="text-sm text-destructive">{errors.contato.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <select className="h-10 rounded-md border border-border bg-secondary px-3" {...register("tipo")}>
                    <option value="acabamento">Acabamento</option>
                    <option value="hidraulica">Hidráulica</option>
                    <option value="eletrica">Elétrica</option>
                    <option value="estrutura">Estrutura</option>
                    <option value="outros">Outros</option>
                  </select>
                  {errors.tipo && <p className="text-sm text-destructive">{errors.tipo.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Status *</Label>
                  <select className="h-10 rounded-md border border-border bg-secondary px-3" {...register("status")}>
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                  {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Prazo *</Label>
                  <Input type="date" {...register("prazo")} />
                  {errors.prazo && <p className="text-sm text-destructive">{errors.prazo.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Descrição *</Label>
                  <Input {...register("descricao")} placeholder="Detalhe o problema" />
                  {errors.descricao && <p className="text-sm text-destructive">{errors.descricao.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Responsável</Label>
                  <Input {...register("responsavel")} placeholder="Técnico" />
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
