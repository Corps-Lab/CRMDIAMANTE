import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import logoImage from "@/assets/logo.png";
import { useAgency } from "@/contexts/AgencyContext";
import {
  closePortalTicket,
  createPortalTicket,
  listPortalMessages,
  openPortalTicket,
  sendPortalMessage,
} from "@/lib/portalChat";
import type { PortalChatMessage, PortalChatThread } from "@/types/portalChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PendingAttachments } from "@/components/chat/ChatAttachments";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { safeId } from "@/lib/safeId";
import {
  getBrowserNotificationPermission,
  requestBrowserPushPermission,
  showBrowserPush,
} from "@/lib/browserPush";
import { toast } from "sonner";
import {
  LogOut,
  MessageCircle,
  Mic,
  Paperclip,
  RefreshCcw,
  Send,
  Square,
} from "lucide-react";

type PortalMode = "novo" | "acessar";

type PortalSession = {
  protocol: string;
  accessKey: string;
};

const statusLabel: Record<string, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

function sessionStorageKey(agencyId: string) {
  return `crm_${agencyId}_portal_cliente_session`;
}

export default function PortalCliente() {
  const { currentAgency } = useAgency();
  const portalAuthUrl = `${import.meta.env.BASE_URL}portal/`;
  const [mode, setMode] = useState<PortalMode>("novo");
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<PortalChatThread | null>(null);
  const [messages, setMessages] = useState<PortalChatMessage[]>([]);
  const [session, setSession] = useState<PortalSession | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    getBrowserNotificationPermission(),
  );
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const messageFileInputRef = useRef<HTMLInputElement | null>(null);
  const createPendingRef = useRef<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const messagePendingRef = useRef<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const [createPendingFiles, setCreatePendingFiles] = useState<
    Array<{ id: string; file: File; previewUrl: string }>
  >([]);
  const [messagePendingFiles, setMessagePendingFiles] = useState<
    Array<{ id: string; file: File; previewUrl: string }>
  >([]);
  const [formCreate, setFormCreate] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientDocument: "",
    subject: "",
    message: "",
  });
  const [formAccess, setFormAccess] = useState({
    protocol: "",
    accessKey: "",
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeKey = useMemo(() => sessionStorageKey(currentAgency.id), [currentAgency.id]);

  const persistSession = useCallback(
    (nextSession: PortalSession | null) => {
      setSession(nextSession);
      try {
        if (!nextSession) {
          localStorage.removeItem(activeKey);
        } else {
          localStorage.setItem(activeKey, JSON.stringify(nextSession));
        }
      } catch {
        // ignore storage failures
      }
    },
    [activeKey],
  );

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  const applyConversation = useCallback(
    (
      response: { thread: PortalChatThread; messages: PortalChatMessage[] },
      notifySupportIncoming = false,
    ) => {
      const incoming: PortalChatMessage[] = [];
      response.messages.forEach((message) => {
        const isKnown = knownMessageIdsRef.current.has(message.id);
        if (!isKnown) incoming.push(message);
        knownMessageIdsRef.current.add(message.id);
      });

      setThread(response.thread);
      setMessages(response.messages);

      if (notifySupportIncoming && pushPermission === "granted") {
        incoming
          .filter((message) => message.senderType === "suporte")
          .forEach((message) => {
            const body =
              message.message ||
              (message.attachments.length > 0
                ? `Suporte enviou ${message.attachments.length} anexo(s)`
                : "Nova mensagem do suporte.");
            showBrowserPush({
              title: `Suporte DIAMANTE • ${response.thread.protocol}`,
              body,
              url: window.location.href,
              tag: `portal-thread-${response.thread.id}`,
            });
          });
      }
    },
    [pushPermission],
  );

  const clearCreatePending = useCallback(() => {
    setCreatePendingFiles((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    if (createFileInputRef.current) createFileInputRef.current.value = "";
  }, []);

  const clearMessagePending = useCallback(() => {
    setMessagePendingFiles((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    if (messageFileInputRef.current) messageFileInputRef.current.value = "";
  }, []);

  const addPickedFiles = (
    files: File[],
    setter: Dispatch<SetStateAction<Array<{ id: string; file: File; previewUrl: string }>>>,
  ) => {
    setter((current) => {
      const available = Math.max(0, 5 - current.length);
      const next = files.slice(0, available).map((file) => ({
        id: safeId("chat-file"),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...current, ...next];
    });
  };

  const startAudioRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador nao suporta gravacao de audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      recorderChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recorderChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size > 0) {
          const ext = blob.type.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `audio-${Date.now()}.${ext}`, {
            type: blob.type || "audio/webm",
          });
          addPickedFiles([file], setMessagePendingFiles);
        }
        recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        recorderChunksRef.current = [];
      };

      recorder.start();
      setRecordingAudio(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel iniciar gravacao.";
      toast.error(message);
    }
  };

  const stopAudioRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecordingAudio(false);
  };

  const handlePickCreateFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    addPickedFiles(files, setCreatePendingFiles);
    event.target.value = "";
  };

  const handlePickMessageFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    addPickedFiles(files, setMessagePendingFiles);
    event.target.value = "";
  };

  const removeCreatePending = (id: string) => {
    setCreatePendingFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const removeMessagePending = (id: string) => {
    setMessagePendingFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const loadConversation = useCallback(
    async (protocol: string, accessKey: string, notifyError = true) => {
      try {
        const response = await openPortalTicket(protocol, accessKey, currentAgency.id);
        applyConversation(response, false);
        persistSession({ protocol, accessKey });
        scrollToBottom();
      } catch (error) {
        if (notifyError) {
          const message =
            error instanceof Error ? error.message : "Falha ao abrir atendimento.";
          toast.error(message);
        }
        throw error;
      }
    },
    [applyConversation, currentAgency.id, persistSession],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(activeKey);
      if (raw) {
        const parsed = JSON.parse(raw) as PortalSession;
        if (parsed?.protocol && parsed?.accessKey) {
          loadConversation(parsed.protocol, parsed.accessKey, false).catch(() => {
            persistSession(null);
          });
        }
      }
    } catch {
      // ignore parse/storage issues
    }

    const params = new URLSearchParams(window.location.search);
    const protocol = params.get("protocolo");
    const accessKey = params.get("chave");
    if (protocol) {
      setMode("acessar");
      setFormAccess((prev) => ({
        ...prev,
        protocol: protocol.toUpperCase(),
        accessKey: accessKey ? accessKey.toUpperCase() : prev.accessKey,
      }));
    }
  }, [activeKey, loadConversation, persistSession]);

  useEffect(() => {
    const syncPermission = () => setPushPermission(getBrowserNotificationPermission());
    window.addEventListener("focus", syncPermission);
    return () => window.removeEventListener("focus", syncPermission);
  }, []);

  useEffect(() => {
    createPendingRef.current = createPendingFiles;
  }, [createPendingFiles]);

  useEffect(() => {
    messagePendingRef.current = messagePendingFiles;
  }, [messagePendingFiles]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      createPendingRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      messagePendingRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await listPortalMessages(
          session.protocol,
          session.accessKey,
          null,
          currentAgency.id,
        );
        applyConversation(response, true);
      } catch {
        // silently retry on next tick
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session, currentAgency.id, applyConversation]);

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const created = await createPortalTicket(
        {
          clientName: formCreate.clientName,
          clientEmail: formCreate.clientEmail,
          clientPhone: formCreate.clientPhone,
          clientDocument: formCreate.clientDocument,
          subject: formCreate.subject,
          message: formCreate.message,
          attachments: createPendingFiles.map((item) => item.file),
        },
        currentAgency.id,
      );
      applyConversation(created, false);
      persistSession({ protocol: created.protocol, accessKey: created.accessKey });
      setFormAccess({ protocol: created.protocol, accessKey: created.accessKey });
      toast.success("Atendimento criado com sucesso.");
      toast.success(
        `Protocolo ${created.protocol} | Chave ${created.accessKey}. Guarde esses dados.`,
      );
      clearCreatePending();
      scrollToBottom();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel abrir atendimento.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccessTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const protocol = formAccess.protocol.trim().toUpperCase();
      const accessKey = formAccess.accessKey.trim().toUpperCase();
      await loadConversation(protocol, accessKey);
      toast.success("Atendimento carregado.");
    } catch {
      // handled in loadConversation
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!session || (!newMessage.trim() && messagePendingFiles.length === 0)) return;
    setSending(true);
    try {
      await sendPortalMessage(
        session.protocol,
        session.accessKey,
        newMessage,
        thread?.clientName || formCreate.clientName || "Cliente",
        currentAgency.id,
        messagePendingFiles.map((item) => item.file),
      );
      setNewMessage("");
      clearMessagePending();
      const updated = await listPortalMessages(
        session.protocol,
        session.accessKey,
        null,
        currentAgency.id,
      );
      applyConversation(updated, false);
      scrollToBottom();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao enviar mensagem.";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const updated = await listPortalMessages(
        session.protocol,
        session.accessKey,
        null,
        currentAgency.id,
      );
      applyConversation(updated, false);
      toast.success("Conversa atualizada.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao atualizar conversa.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const updated = await closePortalTicket(
        session.protocol,
        session.accessKey,
        currentAgency.id,
      );
      setThread(updated);
      toast.success("Atendimento encerrado.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao encerrar atendimento.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    if (recordingAudio) {
      stopAudioRecording();
    }
    persistSession(null);
    knownMessageIdsRef.current = new Set();
    setThread(null);
    setMessages([]);
    setNewMessage("");
    clearCreatePending();
    clearMessagePending();
  };

  const enablePush = async () => {
    const permission = await requestBrowserPushPermission();
    setPushPermission(permission);
    if (permission === "granted") {
      toast.success("Push ativado. Avisaremos quando o suporte responder.");
      return;
    }
    toast.error("Permita notificacoes no navegador para receber alertas.");
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Card className="border-primary/30 bg-black/30 backdrop-blur-md">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="CRM DIAMANTE" className="h-12 w-12 object-contain" />
              <div>
                <CardTitle className="text-xl">Portal do Cliente</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Atendimento direto com o Suporte CRM DIAMANTE.
                </p>
              </div>
            </div>
            {session ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-black">Protocolo: {session.protocol}</Badge>
                <Badge variant="outline">
                  Status: {statusLabel[thread?.status || "aberto"] || "Aberto"}
                </Badge>
                <Button type="button" variant="outline" asChild>
                  <a href={portalAuthUrl} target="_blank" rel="noreferrer">
                    Abrir Login do Portal
                  </a>
                </Button>
                <Button
                  type="button"
                  variant={pushPermission === "granted" ? "secondary" : "outline"}
                  onClick={enablePush}
                >
                  {pushPermission === "granted" ? "Push ativo" : "Ativar push"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" asChild>
                  <a href={portalAuthUrl} target="_blank" rel="noreferrer">
                    Abrir Login do Portal
                  </a>
                </Button>
                <Button
                  type="button"
                  variant={mode === "novo" ? "default" : "outline"}
                  onClick={() => setMode("novo")}
                >
                  Novo atendimento
                </Button>
                <Button
                  type="button"
                  variant={mode === "acessar" ? "default" : "outline"}
                  onClick={() => setMode("acessar")}
                >
                  Acessar atendimento
                </Button>
                <Button
                  type="button"
                  variant={pushPermission === "granted" ? "secondary" : "outline"}
                  onClick={enablePush}
                >
                  {pushPermission === "granted" ? "Push ativo" : "Ativar push"}
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {!session ? (
              mode === "novo" ? (
                <form className="space-y-3" onSubmit={handleCreateTicket}>
                  <input
                    ref={createFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                    className="hidden"
                    onChange={handlePickCreateFiles}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Nome completo *</Label>
                      <Input
                        value={formCreate.clientName}
                        onChange={(event) =>
                          setFormCreate((prev) => ({ ...prev, clientName: event.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={formCreate.clientEmail}
                        onChange={(event) =>
                          setFormCreate((prev) => ({ ...prev, clientEmail: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>WhatsApp</Label>
                      <Input
                        value={formCreate.clientPhone}
                        onChange={(event) =>
                          setFormCreate((prev) => ({ ...prev, clientPhone: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>CPF/CNPJ</Label>
                      <Input
                        value={formCreate.clientDocument}
                        onChange={(event) =>
                          setFormCreate((prev) => ({
                            ...prev,
                            clientDocument: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Assunto *</Label>
                    <Input
                      value={formCreate.subject}
                      onChange={(event) =>
                        setFormCreate((prev) => ({ ...prev, subject: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Mensagem inicial</Label>
                    <Textarea
                      value={formCreate.message}
                      onChange={(event) =>
                        setFormCreate((prev) => ({ ...prev, message: event.target.value }))
                      }
                      className="min-h-28"
                    />
                  </div>
                  <PendingAttachments files={createPendingFiles} onRemove={removeCreatePending} />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => createFileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                    Anexar foto, video ou arquivo
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || (!formCreate.message.trim() && createPendingFiles.length === 0)}
                    className="w-full"
                  >
                    {loading ? "Abrindo atendimento..." : "Abrir atendimento"}
                  </Button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={handleAccessTicket}>
                  <div className="space-y-1">
                    <Label>Protocolo *</Label>
                    <Input
                      value={formAccess.protocol}
                      onChange={(event) =>
                        setFormAccess((prev) => ({
                          ...prev,
                          protocol: event.target.value.toUpperCase(),
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Chave de acesso *</Label>
                    <Input
                      value={formAccess.accessKey}
                      onChange={(event) =>
                        setFormAccess((prev) => ({
                          ...prev,
                          accessKey: event.target.value.toUpperCase(),
                        }))
                      }
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Acessando..." : "Entrar no atendimento"}
                  </Button>
                </form>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="gap-2" onClick={handleRefresh}>
                    <RefreshCcw className="w-4 h-4" />
                    Atualizar
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseTicket} disabled={loading}>
                    Encerrar atendimento
                  </Button>
                  <Button type="button" variant="ghost" className="gap-2" onClick={clearSession}>
                    <LogOut className="w-4 h-4" />
                    Sair do atendimento
                  </Button>
                </div>

                <div className="h-[48vh] overflow-y-auto rounded-lg border border-border bg-black/20 p-3 space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                  ) : (
                    messages.map((message) => (
                      <ChatMessageItem
                        key={message.id}
                        message={message}
                        currentSenderType="cliente"
                      />
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="space-y-2">
                  <input
                    ref={messageFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                    className="hidden"
                    onChange={handlePickMessageFiles}
                  />
                  <Textarea
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder="Escreva sua mensagem para o suporte..."
                    className="min-h-20 resize-none"
                  />
                  {recordingAudio ? (
                    <p className="text-xs text-primary">
                      Gravando audio... clique em Parar para anexar.
                    </p>
                  ) : null}
                  <PendingAttachments files={messagePendingFiles} onRemove={removeMessagePending} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => messageFileInputRef.current?.click()}
                    >
                      <Paperclip className="w-4 h-4" />
                      Anexar arquivo
                    </Button>
                    <Button
                      type="button"
                      variant={recordingAudio ? "destructive" : "outline"}
                      className="gap-2"
                      onClick={recordingAudio ? stopAudioRecording : startAudioRecording}
                    >
                      {recordingAudio ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      {recordingAudio ? "Parar" : "Audio"}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={
                      sending ||
                      recordingAudio ||
                      (!newMessage.trim() && messagePendingFiles.length === 0)
                    }
                    className="w-full gap-2"
                  >
                    {sending ? (
                      "Enviando..."
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar mensagem
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5 text-primary" />
            Suporte oficial da Construtora DIAMANTE
          </p>
        </div>
      </div>
    </div>
  );
}
