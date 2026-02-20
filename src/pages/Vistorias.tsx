import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAssist } from "@/contexts/AssistContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useAgency } from "@/contexts/AgencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { ticketSchema, TicketSchemaType } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, ImagePlus, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Ticket } from "@/types/assistencia";

// Reuso do modelo de ticket como punch list (origem vistoria)

const MAX_PHOTOS_PER_TICKET = 5;
const MAX_PHOTO_FILE_SIZE_MB = 12;
const MAX_PHOTO_DATA_URL_LENGTH = 750_000;

type TicketPhotoMap = Record<string, string[]>;

export default function Vistorias() {
  const { tickets, addTicket, updateTicket, removeTicket, loading } = useAssist();
  const { projects } = useProjects();
  const { currentAgency } = useAgency();
  const { user } = useAuth();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [search, setSearch] = useState("");
  const [photosByTicketId, setPhotosByTicketId] = useState<TicketPhotoMap>({});
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const { toast } = useToast();
  const photoStorageKey = useMemo(
    () => `crm_${currentAgency.id}_${user?.id ?? "anon"}_vistoria_photos`,
    [currentAgency.id, user?.id],
  );

  // filtramos apenas os de vistoria pela palavra-chave [VISTORIA]
  const vistoriaTickets = tickets.filter((t) => t.descricao?.includes("[VISTORIA]"));
  const filtered = vistoriaTickets.filter((t) =>
    t.cliente.toLowerCase().includes(search.toLowerCase()) ||
    t.unidade.toLowerCase().includes(search.toLowerCase()) ||
    t.descricao.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(photoStorageKey);
      const parsed = raw ? (JSON.parse(raw) as TicketPhotoMap) : {};
      setPhotosByTicketId(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setPhotosByTicketId({});
    }
  }, [photoStorageKey]);

  const persistPhotos = (next: TicketPhotoMap) => {
    try {
      localStorage.setItem(photoStorageKey, JSON.stringify(next));
      setPhotosByTicketId(next);
    } catch {
      throw new Error("Espaco insuficiente para salvar fotos desta vistoria.");
    }
  };

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<TicketSchemaType>({
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

  const readImageAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });

  const compressImageDataUrl = (rawDataUrl: string) =>
    new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const maxDimension = 1280;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
      };
      image.onerror = () => resolve(rawDataUrl);
      image.src = rawDataUrl;
    });

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const selected = Array.from(files);
    const currentCount = draftPhotos.length;
    const availableSlots = Math.max(0, MAX_PHOTOS_PER_TICKET - currentCount);

    if (availableSlots === 0) {
      toast({
        title: "Limite atingido",
        description: `Cada vistoria aceita no maximo ${MAX_PHOTOS_PER_TICKET} fotos.`,
        variant: "destructive",
      });
      return;
    }

    setIsPhotoLoading(true);
    const nextPhotos: string[] = [];
    let skipped = 0;

    try {
      for (const file of selected.slice(0, availableSlots)) {
        const tooLarge = file.size > MAX_PHOTO_FILE_SIZE_MB * 1024 * 1024;
        if (tooLarge) {
          skipped += 1;
          continue;
        }
        try {
          const dataUrl = await readImageAsDataUrl(file);
          const compressedDataUrl = await compressImageDataUrl(dataUrl);
          if (compressedDataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
            skipped += 1;
            continue;
          }
          nextPhotos.push(compressedDataUrl);
        } catch {
          skipped += 1;
        }
      }
    } finally {
      setIsPhotoLoading(false);
    }

    setDraftPhotos((prev) => [...prev, ...nextPhotos]);

    if (nextPhotos.length > 0) {
      toast({
        title: "Fotos adicionadas",
        description: `${nextPhotos.length} foto(s) pronta(s) para esta vistoria.`,
      });
    }
    if (skipped > 0) {
      toast({
        title: "Algumas fotos nao foram aceitas",
        description: `Use imagens ate ${MAX_PHOTO_FILE_SIZE_MB}MB. Fotos muito grandes sao recusadas.`,
        variant: "destructive",
      });
    }
  };

  const removeDraftPhoto = (index: number) => {
    setDraftPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const openNewForm = () => {
    setEditing(null);
    setDraftPhotos([]);
    reset({
      unidade: "",
      cliente: "",
      contato: "",
      tipo: "acabamento",
      status: "aberto",
      prazo: "",
      descricao: "",
      responsavel: "",
    });
    setFormOpen(true);
  };

  const openEditForm = (ticket: Ticket) => {
    const cleanDescription = ticket.descricao.replace("[VISTORIA] ", "");
    setEditing(ticket);
    setDraftPhotos(photosByTicketId[ticket.id] || []);
    reset({
      unidade: ticket.unidade,
      cliente: ticket.cliente,
      contato: ticket.contato,
      tipo: ticket.tipo,
      status: ticket.status,
      prazo: ticket.prazo,
      descricao: cleanDescription,
      responsavel: ticket.responsavel || "",
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: TicketSchemaType) => {
    const payload = {
      ...data,
      descricao: `[VISTORIA] ${data.descricao}`,
    } as TicketSchemaType;
    try {
      if (editing) {
        await updateTicket(editing.id, payload);
        const nextMap = { ...photosByTicketId, [editing.id]: draftPhotos };
        persistPhotos(nextMap);
        toast({ title: "Pendência atualizada", description: data.descricao });
        setEditing(null);
      } else {
        const createdTicket = await addTicket(payload);
        if (draftPhotos.length > 0) {
          const nextMap = { ...photosByTicketId, [createdTicket.id]: draftPhotos };
          persistPhotos(nextMap);
        }
        toast({ title: "Pendência criada", description: data.descricao });
      }
      setFormOpen(false);
      setDraftPhotos([]);
      reset();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      await removeTicket(ticketId);
      const nextMap = { ...photosByTicketId };
      delete nextMap[ticketId];
      persistPhotos(nextMap);
      toast({ title: "Pendencia removida" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <ClipboardCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vistorias / Punch List</h1>
              <p className="text-sm text-muted-foreground">{loading ? "Carregando..." : `${vistoriaTickets.length} pendência(s)`}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por unidade, cliente ou item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs bg-card border-border"
            />
            <Button onClick={openNewForm} className="gap-2">
              <Plus className="w-4 h-4" /> Nova pendência
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="border-border bg-card/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{t.unidade}</span>
                  <Badge variant={t.status === "concluido" ? "default" : "outline"}>{t.status}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Cliente: {t.cliente}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="text-foreground">{t.descricao.replace("[VISTORIA] ", "")}</p>
                <p><strong className="text-foreground">Prazo:</strong> {new Intl.DateTimeFormat("pt-BR").format(new Date(t.prazo))}</p>
                <p><strong className="text-foreground">Responsável:</strong> {t.responsavel || "—"}</p>
                {photosByTicketId[t.id]?.length ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{photosByTicketId[t.id].length} foto(s)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {photosByTicketId[t.id].map((photo, idx) => (
                        <button key={`${t.id}-photo-${idx}`} type="button" onClick={() => setPhotoPreview(photo)}>
                          <img src={photo} alt={`Vistoria ${idx + 1}`} className="h-20 w-full rounded-md object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem fotos</p>
                )}
                <div className="flex justify-between text-xs text-foreground">
                  <button className="text-primary" onClick={() => openEditForm(t)}>Editar</button>
                  <button className="text-destructive" onClick={() => handleDeleteTicket(t.id)}>Excluir</button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[620px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">{editing ? "Editar pendência" : "Nova pendência"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Obra</Label>
                  <select className="h-10 rounded-md border border-border bg-secondary px-3" onChange={(e) => setValue("unidade", e.target.value)}>
                    <option value="">Selecione a obra (opcional)</option>
                    {projects.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Unidade *</Label>
                  <Input {...register("unidade")} placeholder="Torre A - 1201" />
                  {errors.unidade && <p className="text-sm text-destructive">{errors.unidade.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Cliente *</Label>
                  <Input {...register("cliente")} placeholder="Proprietário" />
                  {errors.cliente && <p className="text-sm text-destructive">{errors.cliente.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Contato *</Label>
                  <Input {...register("contato")} placeholder="Telefone ou email" />
                  {errors.contato && <p className="text-sm text-destructive">{errors.contato.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Status *</Label>
                  <select className="h-10 rounded-md border border-border bg-secondary px-3" {...register("status")}
                    defaultValue="aberto"
                  >
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
                  <Input {...register("descricao")} placeholder="Ex: Refazer rejunte, porta desalinhada" />
                  {errors.descricao && <p className="text-sm text-destructive">{errors.descricao.message}</p>}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Responsável</Label>
                  <Input {...register("responsavel")} placeholder="Time / empreiteiro" />
                </div>
                <div className="md:col-span-2 space-y-2 rounded-md border border-border/70 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ImagePlus className="h-4 w-4" />
                    Fotos da vistoria
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      void handlePhotoFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ate {MAX_PHOTOS_PER_TICKET} fotos por vistoria, maximo {MAX_PHOTO_FILE_SIZE_MB}MB por imagem.
                  </p>
                  {isPhotoLoading && <p className="text-xs text-muted-foreground">Processando imagens...</p>}
                  {draftPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {draftPhotos.map((photo, idx) => (
                        <div key={`draft-photo-${idx}`} className="relative">
                          <button type="button" onClick={() => setPhotoPreview(photo)}>
                            <img src={photo} alt={`Foto ${idx + 1}`} className="h-24 w-full rounded-md object-cover" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDraftPhoto(idx)}
                            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                            aria-label="Remover foto"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{editing ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {photoPreview && (
          <Dialog open={!!photoPreview} onOpenChange={(open) => !open && setPhotoPreview(null)}>
            <DialogContent className="max-w-3xl">
              <img src={photoPreview} alt="Preview da vistoria" className="h-auto w-full rounded-md" />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}
