import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAgency } from "@/contexts/AgencyContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getSupportThreadMessages,
  listSupportThreads,
  markSupportThreadAsRead,
  sendSupportMessage,
  updateSupportThreadStatus,
} from "@/lib/portalChat";
import { safeId } from "@/lib/safeId";
import {
  getBrowserNotificationPermission,
  requestBrowserPushPermission,
  showBrowserPush,
} from "@/lib/browserPush";
import type {
  PortalChatMessage,
  PortalThreadStatus,
  SupportThreadSummary,
} from "@/types/portalChat";
import { PendingAttachments } from "@/components/chat/ChatAttachments";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import {
  MessageCircle,
  Mic,
  Paperclip,
  RefreshCcw,
  Send,
  Square,
} from "lucide-react";

const statusLabel: Record<PortalThreadStatus, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function Suporte() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { currentAgency, isIsolated } = useAgency();
  const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [chatWindowOpen, setChatWindowOpen] = useState(false);
  const [messages, setMessages] = useState<PortalChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    getBrowserNotificationPermission(),
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFilesRef = useRef<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const threadsRef = useRef<SupportThreadSummary[]>([]);
  const [pendingFiles, setPendingFiles] = useState<
    Array<{ id: string; file: File; previewUrl: string }>
  >([]);

  const addPendingFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    setPendingFiles((current) => {
      const available = Math.max(0, 5 - current.length);
      const next = files.slice(0, available).map((file) => ({
        id: safeId("chat-file"),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...current, ...next];
    });
  }, []);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) => {
      return (
        thread.protocol.toLowerCase().includes(query) ||
        thread.clientName.toLowerCase().includes(query) ||
        thread.subject.toLowerCase().includes(query)
      );
    });
  }, [threads, search]);

  const scrollMessagesToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  const clearPendingFiles = useCallback(() => {
    setPendingFiles((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handlePickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    addPendingFiles(files);
    event.target.value = "";
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    const syncPermission = () => setPushPermission(getBrowserNotificationPermission());
    window.addEventListener("focus", syncPermission);
    return () => window.removeEventListener("focus", syncPermission);
  }, []);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      pendingFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const data = await listSupportThreads(currentAgency.id);
      setThreads(data);
      setSelectedThreadId((prev) => {
        if (prev && data.some((thread) => thread.id === prev)) return prev;
        return data[0]?.id || null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar suporte.";
      toast({ title: "Erro no suporte", description: message, variant: "destructive" });
    } finally {
      setLoadingThreads(false);
    }
  }, [currentAgency.id, toast]);

  const loadMessages = useCallback(
    async (threadId: string, markAsRead = true) => {
      setLoadingMessages(true);
      try {
        const data = await getSupportThreadMessages(threadId, currentAgency.id);
        data.forEach((message) => knownMessageIdsRef.current.add(message.id));
        setMessages(data);
        if (markAsRead) {
          await markSupportThreadAsRead(threadId, currentAgency.id);
          setThreads((prev) =>
            prev.map((thread) =>
              thread.id === threadId ? { ...thread, unreadBySupport: 0 } : thread,
            ),
          );
        }
        scrollMessagesToBottom();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar conversa.";
        toast({ title: "Erro ao abrir chat", description: message, variant: "destructive" });
      } finally {
        setLoadingMessages(false);
      }
    },
    [currentAgency.id, toast],
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedThreadId);
  }, [selectedThreadId, loadMessages]);

  useEffect(() => {
    if (isIsolated) return;
    const channel = supabase
      .channel(`portal-chat-support-${currentAgency.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_chat_threads" },
        () => {
          loadThreads();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_chat_messages" },
        (payload) => {
          loadThreads();
          const row = ((payload.new || payload.old || {}) as Record<string, unknown>) || {};
          const threadId = String(row.thread_id || "");
          const messageId = String(row.id || "");
          const senderType = String(row.sender_type || "");
          const isInsert = payload.eventType === "INSERT";
          const isNewMessage = isInsert && messageId && !knownMessageIdsRef.current.has(messageId);
          if (messageId) knownMessageIdsRef.current.add(messageId);

          if (isNewMessage && senderType === "cliente" && pushPermission === "granted") {
            const senderName = String(row.sender_name || "Cliente");
            const messageText = String(row.message || "").trim();
            const attachmentsCount = Array.isArray(row.attachments) ? row.attachments.length : 0;
            const thread = threadsRef.current.find((item) => item.id === threadId);
            const body =
              messageText ||
              (attachmentsCount > 0
                ? `Enviou ${attachmentsCount} anexo(s)`
                : "Nova mensagem no atendimento.");
            showBrowserPush({
              title: `${senderName} • ${thread?.protocol || "Suporte"}`,
              body,
              url: window.location.href,
              tag: `support-thread-${threadId}`,
            });
          }

          if (threadId && threadId === selectedThreadId) {
            loadMessages(threadId, false);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAgency.id, isIsolated, loadMessages, loadThreads, selectedThreadId, pushPermission]);

  const enablePush = async () => {
    const permission = await requestBrowserPushPermission();
    setPushPermission(permission);
    if (permission === "granted") {
      toast({ title: "Push ativado", description: "Voce recebera alertas de novas mensagens." });
      return;
    }
    toast({
      title: "Push bloqueado",
      description: "Permita notificacoes no navegador para receber alertas.",
      variant: "destructive",
    });
  };

  const startAudioRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Audio indisponivel",
        description: "Seu navegador nao suporta gravacao de audio.",
        variant: "destructive",
      });
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
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const ext = blob.type.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `audio-${Date.now()}.${ext}`, {
            type: blob.type || "audio/webm",
          });
          addPendingFiles([file]);
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
      toast({ title: "Erro no microfone", description: message, variant: "destructive" });
    }
  };

  const stopAudioRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecordingAudio(false);
  };

  const handleChatWindowChange = (open: boolean) => {
    setChatWindowOpen(open);
    if (!open && recordingAudio) {
      stopAudioRecording();
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId || (!composer.trim() && pendingFiles.length === 0)) return;
    setSendingMessage(true);
    try {
      await sendSupportMessage(
        selectedThreadId,
        composer,
        {
          senderName: profile?.nome || user?.email || "Suporte CRM DIAMANTE",
          senderUserId: user?.id || null,
          attachments: pendingFiles.map((item) => item.file),
        },
        currentAgency.id,
      );
      setComposer("");
      clearPendingFiles();
      await loadMessages(selectedThreadId, false);
      await loadThreads();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar resposta.";
      toast({ title: "Erro ao responder", description: message, variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusChange = async (status: PortalThreadStatus) => {
    if (!selectedThreadId) return;
    setUpdatingStatus(true);
    try {
      await updateSupportThreadStatus(selectedThreadId, status, currentAgency.id);
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === selectedThreadId ? { ...thread, status } : thread,
        ),
      );
      toast({ title: "Status atualizado", description: `Atendimento ${statusLabel[status]}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar status.";
      toast({ title: "Erro ao atualizar", description: message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Suporte Integrado</h1>
            <p className="text-sm text-muted-foreground">
              Chat interno do CRM DIAMANTE.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" className="gap-2" onClick={loadThreads}>
              <RefreshCcw className="w-4 h-4" />
              Atualizar
            </Button>
            <Button
              variant={pushPermission === "granted" ? "secondary" : "outline"}
              className="gap-2"
              onClick={enablePush}
            >
              {pushPermission === "granted" ? "Push ativo" : "Ativar push"}
            </Button>
          </div>
        </div>

        <div className="max-w-3xl">
          <Card className="bg-card/80 border-border">
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg">Atendimentos</CardTitle>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por protocolo, cliente ou assunto"
              />
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {loadingThreads ? (
                <p className="text-sm text-muted-foreground">Carregando atendimentos...</p>
              ) : filteredThreads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum atendimento encontrado.
                </p>
              ) : (
                filteredThreads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      setChatWindowOpen(true);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedThreadId === thread.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40 hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">{thread.protocol}</span>
                      {thread.unreadBySupport > 0 ? (
                        <Badge className="bg-primary text-black">{thread.unreadBySupport}</Badge>
                      ) : (
                        <Badge variant="outline">{statusLabel[thread.status]}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold">{thread.clientName}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{thread.subject}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(thread.lastMessageAt)}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={chatWindowOpen} onOpenChange={handleChatWindowChange}>
          <DialogContent className="max-w-4xl overflow-hidden border-border bg-card p-0">
            <DialogTitle className="sr-only">Janela do chat interno</DialogTitle>
            {!selectedThread ? (
              <div className="grid min-h-[60vh] place-items-center p-6 text-center text-muted-foreground">
                <div className="space-y-2">
                  <MessageCircle className="mx-auto h-10 w-10 text-primary" />
                  <p>Selecione um atendimento para abrir o chat.</p>
                </div>
              </div>
            ) : (
              <div className="flex h-[78vh] flex-col">
                <div className="border-b border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">{selectedThread.clientName}</p>
                      <p className="text-xs font-semibold text-primary">
                        Protocolo: {selectedThread.protocol}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedThread.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedThread.clientEmail || "Sem e-mail"} ·{" "}
                        {selectedThread.clientPhone || "Sem telefone"}
                      </p>
                    </div>
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={selectedThread.status}
                      onChange={(event) =>
                        handleStatusChange(event.target.value as PortalThreadStatus)
                      }
                      disabled={updatingStatus}
                    >
                      {Object.entries(statusLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {loadingMessages ? (
                    <p className="text-sm text-muted-foreground">Carregando conversa...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Conversa sem mensagens ainda.</p>
                  ) : (
                    messages.map((message) => (
                      <ChatMessageItem
                        key={message.id}
                        message={message}
                        currentSenderType="suporte"
                      />
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-border p-3 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                    className="hidden"
                    onChange={handlePickFiles}
                  />
                  <Textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    placeholder="Digite a resposta para o cliente..."
                    className="min-h-20 resize-none"
                  />
                  {recordingAudio ? (
                    <p className="text-xs text-primary">
                      Gravando audio... clique em Parar para anexar.
                    </p>
                  ) : null}
                  <PendingAttachments files={pendingFiles} onRemove={removePendingFile} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="w-4 h-4" />
                        Anexar
                      </Button>
                      <Button
                        type="button"
                        variant={recordingAudio ? "destructive" : "outline"}
                        className="gap-2"
                        onClick={recordingAudio ? stopAudioRecording : startAudioRecording}
                      >
                        {recordingAudio ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <Mic className="w-4 h-4" />
                        )}
                        {recordingAudio ? "Parar" : "Audio"}
                      </Button>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={
                        sendingMessage ||
                        recordingAudio ||
                        (!composer.trim() && pendingFiles.length === 0)
                      }
                      className="gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {sendingMessage ? "Enviando..." : "Responder"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
