import { useEffect, useMemo, useState } from "react";
import type { Conversation, Message } from "@crm/shared";
import { edgeOptions, supabase } from "./supabase";

type ChatBackend = "conversation" | "portal_thread";
type ConversationStatus = "new" | "open" | "pending" | "closed";
type ConversationPriority = "low" | "normal" | "high" | "urgent";
type LegacyThreadStatus = "aberto" | "em_atendimento" | "aguardando_cliente" | "resolvido" | "fechado";

type PortalAttachment = {
  name: string;
  type: string;
  size: number;
  path?: string;
  url?: string;
  kind?: "image" | "video" | "audio" | "file";
};

type MessageView = Message & {
  legacyAttachments?: PortalAttachment[];
};

type PortalThreadRow = {
  id: string;
  protocol: string;
  client_name: string;
  client_document: string | null;
  subject: string;
  status: LegacyThreadStatus;
  assigned_to: string | null;
  metadata: Record<string, unknown> | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

type ConversationWithMeta = Conversation & {
  contract?: {
    development_name: string;
    unit_label: string;
  };
  client_name?: string;
  client_cpf?: string;
  legacyThread?: PortalThreadRow;
  legacyStatus?: LegacyThreadStatus;
};

const STATUS_TABS: ConversationStatus[] = ["new", "open", "pending", "closed"];
const PRIORITIES: ConversationPriority[] = ["low", "normal", "high", "urgent"];

const LEGACY_STATUS_TO_TAB: Record<LegacyThreadStatus, ConversationStatus> = {
  aberto: "new",
  em_atendimento: "open",
  aguardando_cliente: "pending",
  resolvido: "closed",
  fechado: "closed",
};

const TAB_TO_LEGACY_STATUS: Record<ConversationStatus, LegacyThreadStatus> = {
  new: "aberto",
  open: "em_atendimento",
  pending: "aguardando_cliente",
  closed: "fechado",
};

function sanitizePortalBase(raw: string) {
  return raw.replace(/\/+$/, "");
}

function normalizeRole(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function readObjectString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isMissingTableError(error: unknown) {
  if (!isRecord(error)) return false;
  const code = typeof error.code === "string" ? error.code : "";
  return code === "PGRST205";
}

function isMissingColumnError(error: unknown) {
  if (!isRecord(error)) return false;
  const code = typeof error.code === "string" ? error.code : "";
  return code === "PGRST204" || code === "42703";
}

function mapLegacyThread(thread: PortalThreadRow): ConversationWithMeta {
  const metadata = isRecord(thread.metadata) ? thread.metadata : {};
  const contractNumber =
    readObjectString(metadata, ["contract_number", "contractNumber", "contrato"]) || thread.protocol;
  const developmentName = readObjectString(metadata, ["development_name", "empreendimento"]);
  const unitLabel = readObjectString(metadata, ["unit_label", "unidade"]);

  return {
    id: thread.id,
    contract_number: contractNumber,
    user_id: `legacy-${thread.id}`,
    status: LEGACY_STATUS_TO_TAB[thread.status],
    priority: "normal",
    assigned_agent_id: thread.assigned_to,
    last_message_at: thread.last_message_at,
    created_at: thread.created_at,
    client_name: thread.client_name,
    client_cpf: thread.client_document || "",
    contract: developmentName || unitLabel ? { development_name: developmentName, unit_label: unitLabel } : undefined,
    legacyThread: thread,
    legacyStatus: thread.status,
  };
}

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function callPortalChat<T>(payload: Record<string, unknown>, accessToken?: string): Promise<T> {
  const base = edgeOptions.edgeBaseUrl || `${edgeOptions.supabaseUrl}/functions/v1`;
  const url = `${base.replace(/\/$/, "")}/portal-chat`;
  const bearer = accessToken || edgeOptions.anonKey;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: edgeOptions.anonKey,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || json.ok === false) {
    const message = String(json.error || `Falha ao chamar portal-chat (${response.status}).`);
    throw new Error(message);
  }

  return (json.data || json) as T;
}

export default function App() {
  const portalBaseUrl = sanitizePortalBase(
    (import.meta.env.VITE_PORTAL_URL as string | undefined)?.trim() || "http://localhost:5174/#",
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState("");
  const [agentLabel, setAgentLabel] = useState("Suporte CRM DIAMANTE");
  const [chatBackend, setChatBackend] = useState<ChatBackend>("conversation");
  const [tab, setTab] = useState<ConversationStatus>("new");
  const [assignedFilter, setAssignedFilter] = useState<"all" | "me" | "unassigned">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [composer, setComposer] = useState("");
  const [messageType, setMessageType] = useState<"text" | "note">("text");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [macroId, setMacroId] = useState("");
  const [macros, setMacros] = useState<Array<{ id: string; title: string; body: string }>>([]);
  const [linkFeedback, setLinkFeedback] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) || null,
    [conversations, selectedId],
  );

  const portalAuthLink = useMemo(() => `${portalBaseUrl}/login`, [portalBaseUrl]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((item) => item.status === tab)
      .filter((item) => {
        if (assignedFilter === "me") return item.assigned_agent_id === agentId;
        if (assignedFilter === "unassigned") return !item.assigned_agent_id;
        return true;
      })
      .filter((item) => (priorityFilter === "all" ? true : item.priority === priorityFilter))
      .filter((item) => {
        if (!q) return true;
        const haystack = [
          item.contract_number,
          item.client_name || "",
          item.client_cpf || "",
          item.contract?.unit_label || "",
          item.contract?.development_name || "",
          item.legacyThread?.subject || "",
          item.legacyThread?.protocol || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
  }, [conversations, tab, assignedFilter, priorityFilter, search, agentId]);

  async function detectBackend(): Promise<ChatBackend> {
    const probe = await supabase.from("conversations").select("id").limit(1);
    if (probe.error && isMissingTableError(probe.error)) return "portal_thread";
    return "conversation";
  }

  async function resolveInternalAccess(uid: string) {
    const agentRes = await supabase
      .from("agents")
      .select("user_id,display_name,is_active")
      .eq("user_id", uid)
      .maybeSingle();

    if (!agentRes.error && agentRes.data && agentRes.data.is_active !== false) {
      return {
        allowed: true,
        label: String(agentRes.data.display_name || "Agente CRM DIAMANTE"),
      };
    }

    let profileLabel = "";
    let profileRole = "";
    const profilePrimary = await supabase
      .from("profiles")
      .select("user_id,nivel_acesso,cargo,nome,full_name")
      .eq("user_id", uid)
      .maybeSingle();

    if (!profilePrimary.error && profilePrimary.data) {
      const row = profilePrimary.data as Record<string, unknown>;
      profileLabel = readObjectString(row, ["full_name", "nome"]);
      profileRole = normalizeRole(readObjectString(row, ["nivel_acesso", "cargo"]));
    } else if (profilePrimary.error && isMissingColumnError(profilePrimary.error)) {
      const profileLegacy = await supabase
        .from("profiles")
        .select("user_id,nivel_acesso,cargo,nome")
        .eq("user_id", uid)
        .maybeSingle();

      if (!profileLegacy.error && profileLegacy.data) {
        const row = profileLegacy.data as Record<string, unknown>;
        profileLabel = readObjectString(row, ["nome"]);
        profileRole = normalizeRole(readObjectString(row, ["nivel_acesso", "cargo"]));
      }
    }

    if (profileRole && profileRole !== "colaborador" && profileRole !== "cliente") {
      return {
        allowed: true,
        label: profileLabel || "Equipe CRM DIAMANTE",
      };
    }

    const rolePermissions = ["suporte", "ceo", "financeiro", "vendas", "rh", "engenharia", "admin"];
    for (const permission of rolePermissions) {
      const roleCheck = await supabase.rpc("can_access", { _permission: permission, _user_id: uid });
      if (!roleCheck.error && roleCheck.data === true) {
        return {
          allowed: true,
          label: profileLabel || "Equipe CRM DIAMANTE",
        };
      }
    }

    return { allowed: false, label: "" };
  }

  async function checkSession() {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const access = await resolveInternalAccess(uid);
    if (!access.allowed) {
      await supabase.auth.signOut();
      setAuthError("Usuario sem permissao para o CRM interno.");
      setLoading(false);
      return;
    }

    setAgentId(uid);
    setAgentLabel(access.label || "Suporte CRM DIAMANTE");
    setChatBackend(await detectBackend());
    setLoading(false);
  }

  async function loadMacrosSafe() {
    const macroRes = await supabase
      .from("macros")
      .select("id,title,body")
      .order("created_at", { ascending: false });
    if (!macroRes.error && Array.isArray(macroRes.data)) {
      setMacros(macroRes.data as Array<{ id: string; title: string; body: string }>);
    } else {
      setMacros([]);
    }
  }

  async function loadConversationsFromModernTables() {
    const convRes = await supabase.from("conversations").select("*");
    if (convRes.error) {
      setAuthError(convRes.error.message);
      return;
    }

    const list = (convRes.data || []) as Conversation[];
    const contractNumbers = Array.from(new Set(list.map((item) => item.contract_number)));
    const userIds = Array.from(new Set(list.map((item) => item.user_id)));

    let profileRows: Array<{ user_id: string; full_name?: string; nome?: string; cpf?: string }> = [];
    const profilePrimary = await supabase.from("profiles").select("user_id,full_name,cpf").in("user_id", userIds);
    if (!profilePrimary.error && Array.isArray(profilePrimary.data)) {
      profileRows = profilePrimary.data as Array<{ user_id: string; full_name?: string; cpf?: string }>;
    } else if (profilePrimary.error && isMissingColumnError(profilePrimary.error)) {
      const profileLegacy = await supabase.from("profiles").select("user_id,nome,cpf").in("user_id", userIds);
      if (!profileLegacy.error && Array.isArray(profileLegacy.data)) {
        profileRows = profileLegacy.data as Array<{ user_id: string; nome?: string; cpf?: string }>;
      }
    }

    let contractRows: Array<{ contract_number: string; development_name?: string; unit_label?: string; titulo?: string }> = [];
    const contractPrimary = await supabase
      .from("contracts")
      .select("contract_number,development_name,unit_label")
      .in("contract_number", contractNumbers);
    if (!contractPrimary.error && Array.isArray(contractPrimary.data)) {
      contractRows = contractPrimary.data as Array<{ contract_number: string; development_name?: string; unit_label?: string }>;
    } else if (contractPrimary.error && isMissingColumnError(contractPrimary.error)) {
      const contractLegacy = await supabase
        .from("contracts")
        .select("id,titulo")
        .in("id", contractNumbers);
      if (!contractLegacy.error && Array.isArray(contractLegacy.data)) {
        contractRows = (contractLegacy.data as Array<{ id: string; titulo?: string }>).map((row) => ({
          contract_number: row.id,
          development_name: row.titulo || "Contrato",
          unit_label: "",
        }));
      }
    }

    const contractsMap = new Map(contractRows.map((item) => [item.contract_number, item]));
    const profilesMap = new Map(
      profileRows.map((item) => [item.user_id, { full_name: item.full_name || item.nome || "Cliente", cpf: item.cpf || "" }]),
    );

    const hydrated: ConversationWithMeta[] = list.map((item) => {
      const profile = profilesMap.get(item.user_id);
      const contract = contractsMap.get(item.contract_number);
      return {
        ...item,
        contract: {
          development_name: contract?.development_name || "",
          unit_label: contract?.unit_label || "",
        },
        client_name: profile?.full_name || "Cliente",
        client_cpf: profile?.cpf || "",
      };
    });

    setConversations(hydrated);
    if (!selectedId && hydrated[0]) setSelectedId(hydrated[0].id);
  }

  async function loadConversationsFromLegacyChat() {
    const res = await supabase
      .from("portal_chat_threads")
      .select("id,protocol,client_name,client_document,subject,status,assigned_to,metadata,last_message_at,created_at,updated_at")
      .order("last_message_at", { ascending: false });

    if (res.error) {
      setAuthError(res.error.message);
      setConversations([]);
      return;
    }

    const rows = (res.data || []) as PortalThreadRow[];
    const mapped = rows.map(mapLegacyThread);
    setConversations(mapped);
    if (!selectedId && mapped[0]) setSelectedId(mapped[0].id);
  }

  async function loadConversations() {
    if (chatBackend === "conversation") {
      await loadConversationsFromModernTables();
      return;
    }
    await loadConversationsFromLegacyChat();
  }

  async function loadModernMessages(conversationId: string) {
    const res = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (res.error) {
      setAuthError(res.error.message);
      setMessages([]);
      return;
    }

    const rows = (res.data || []) as Message[];
    const attachmentIds = rows.map((item) => item.attachment_id).filter(Boolean) as string[];
    const attachmentMap = new Map<string, PortalAttachment[]>();

    if (attachmentIds.length > 0) {
      const attachmentRes = await supabase
        .from("chat_attachments")
        .select("id,storage_path,filename,mime_type,size_bytes")
        .in("id", attachmentIds);

      if (!attachmentRes.error && Array.isArray(attachmentRes.data)) {
        for (const row of attachmentRes.data as Array<Record<string, unknown>>) {
          const id = String(row.id || "");
          const storagePath = String(row.storage_path || "");
          if (!id || !storagePath) continue;

          const signed = await supabase.storage.from("chat").createSignedUrl(storagePath, 120);
          if (signed.error || !signed.data?.signedUrl) continue;

          attachmentMap.set(id, [
            {
              name: String(row.filename || "anexo"),
              type: String(row.mime_type || "application/octet-stream"),
              size: Number(row.size_bytes || 0),
              path: storagePath,
              url: signed.data.signedUrl,
            },
          ]);
        }
      }
    }

    const mapped = rows.map((item) => ({
      ...item,
      legacyAttachments: item.attachment_id ? attachmentMap.get(item.attachment_id) || [] : [],
    }));
    setMessages(mapped);

    const unreadForAgent = rows
      .filter((item) => item.sender_type === "client" && !item.read_at_agent)
      .map((item) => item.id);
    if (unreadForAgent.length > 0) {
      await supabase.from("messages").update({ read_at_agent: new Date().toISOString() }).in("id", unreadForAgent);
    }
  }

  async function loadLegacyMessages(threadId: string) {
    const res = await supabase
      .from("portal_chat_messages")
      .select("id,thread_id,sender_type,message,attachments,read_by_support,read_by_client,created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (res.error) {
      setAuthError(res.error.message);
      setMessages([]);
      return;
    }

    const rows = (res.data || []) as Array<Record<string, unknown>>;

    const unreadClientIds = rows
      .filter((row) => String(row.sender_type || "") === "cliente" && row.read_by_support === false)
      .map((row) => String(row.id || ""))
      .filter(Boolean);

    if (unreadClientIds.length > 0) {
      await supabase
        .from("portal_chat_messages")
        .update({ read_by_support: true })
        .in("id", unreadClientIds);
    }

    const mapped: MessageView[] = rows.map((row) => {
      const senderTypeRaw = String(row.sender_type || "");
      const senderType: Message["sender_type"] =
        senderTypeRaw === "cliente" ? "client" : senderTypeRaw === "suporte" ? "agent" : "system";
      const attachmentList = Array.isArray(row.attachments)
        ? (row.attachments as PortalAttachment[])
        : [];

      return {
        id: String(row.id || crypto.randomUUID()),
        conversation_id: String(row.thread_id || threadId),
        contract_number: selectedConversation?.contract_number || "",
        sender_type: senderType,
        sender_user_id: null,
        message_type: attachmentList.length > 0 ? "attachment" : "text",
        body_text: String(row.message || ""),
        attachment_id: null,
        created_at: String(row.created_at || new Date().toISOString()),
        read_at_client: row.read_by_client ? String(row.created_at || new Date().toISOString()) : null,
        read_at_agent: row.read_by_support ? String(row.created_at || new Date().toISOString()) : null,
        legacyAttachments: attachmentList,
      };
    });

    setMessages(mapped);
  }

  async function loadMessages(conversationId: string) {
    if (chatBackend === "conversation") {
      await loadModernMessages(conversationId);
      return;
    }
    await loadLegacyMessages(conversationId);
  }

  useEffect(() => {
    checkSession().catch((error) => {
      setAuthError(error instanceof Error ? error.message : "Falha de autenticacao");
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkSession().catch(() => {
        setLoading(false);
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!agentId) return;
    loadConversations();
    loadMacrosSafe();
  }, [agentId, chatBackend]);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
  }, [selectedId, chatBackend]);

  useEffect(() => {
    if (!agentId) return;

    if (chatBackend === "conversation") {
      const channel = supabase
        .channel(`agent-inbox-${agentId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
          loadConversations();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
          if (selectedId) loadMessages(selectedId);
          loadConversations();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
          loadConversations();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const timer = window.setInterval(() => {
      loadConversations();
      if (selectedId) loadMessages(selectedId);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [agentId, selectedId, chatBackend]);

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");

    const login = await supabase.auth.signInWithPassword({ email, password });
    if (login.error) {
      setAuthError(login.error.message);
      return;
    }

    await checkSession();
    setEmail("");
    setPassword("");
  }

  async function onLogout() {
    await supabase.auth.signOut();
    setAgentId("");
    setConversations([]);
    setSelectedId("");
    setMessages([]);
  }

  async function onAssignToMe() {
    if (!selectedConversation || !agentId) return;
    if (chatBackend === "conversation") {
      await supabase
        .from("conversations")
        .update({ assigned_agent_id: agentId, status: "open" })
        .eq("id", selectedConversation.id);
      return;
    }

    await supabase
      .from("portal_chat_threads")
      .update({ assigned_to: agentId, status: "em_atendimento" })
      .eq("id", selectedConversation.id);
  }

  async function onUpdateStatus(status: ConversationStatus) {
    if (!selectedConversation) return;
    if (chatBackend === "conversation") {
      await supabase.from("conversations").update({ status }).eq("id", selectedConversation.id);
      return;
    }

    await supabase
      .from("portal_chat_threads")
      .update({ status: TAB_TO_LEGACY_STATUS[status] })
      .eq("id", selectedConversation.id);
  }

  async function onUpdatePriority(priority: string) {
    if (!selectedConversation) return;
    if (chatBackend === "conversation") {
      await supabase.from("conversations").update({ priority }).eq("id", selectedConversation.id);
      return;
    }

    const currentMeta = isRecord(selectedConversation.legacyThread?.metadata)
      ? selectedConversation.legacyThread?.metadata
      : {};
    await supabase
      .from("portal_chat_threads")
      .update({ metadata: { ...(currentMeta || {}), priority } })
      .eq("id", selectedConversation.id);
  }

  async function onSendConversationMessage() {
    if (!selectedConversation || !agentId || (!composer.trim() && !chatFile)) return;

    let attachmentId: string | null = null;
    let finalMessageType: Message["message_type"] = messageType;

    if (chatFile) {
      const objectPath = `${selectedConversation.contract_number}/${selectedConversation.id}/${crypto.randomUUID()}`;
      const upload = await supabase.storage.from("chat").upload(objectPath, chatFile, { upsert: false });
      if (upload.error) {
        setAuthError(upload.error.message);
        return;
      }

      const attachmentRes = await supabase
        .from("chat_attachments")
        .insert({
          conversation_id: selectedConversation.id,
          contract_number: selectedConversation.contract_number,
          storage_path: objectPath,
          filename: chatFile.name,
          mime_type: chatFile.type || "application/octet-stream",
          size_bytes: chatFile.size,
        })
        .select("id")
        .single();

      if (attachmentRes.error || !attachmentRes.data) {
        setAuthError(attachmentRes.error?.message || "Falha ao salvar anexo.");
        return;
      }
      attachmentId = String(attachmentRes.data.id);
      finalMessageType = "attachment";
    }

    const insertRes = await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      contract_number: selectedConversation.contract_number,
      sender_type: "agent",
      sender_user_id: agentId,
      message_type: finalMessageType,
      body_text: composer.trim() || null,
      attachment_id: attachmentId,
    });

    if (insertRes.error) {
      setAuthError(insertRes.error.message);
      return;
    }

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "open",
      })
      .eq("id", selectedConversation.id);

    setComposer("");
    setMessageType("text");
    setChatFile(null);
    await loadMessages(selectedConversation.id);
    await loadConversations();
  }

  async function onSendLegacyMessage() {
    if (!selectedConversation || !agentId || (!composer.trim() && !chatFile)) return;

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setAuthError("Sessao expirada.");
      return;
    }

    const attachments = [];
    if (chatFile) {
      attachments.push({
        name: chatFile.name,
        type: chatFile.type || "application/octet-stream",
        size: chatFile.size,
        contentBase64: await fileToBase64(chatFile),
      });
    }

    await callPortalChat(
      {
        action: "support_send_message",
        threadId: selectedConversation.id,
        message: composer.trim(),
        attachments,
        senderName: agentLabel,
      },
      accessToken,
    );

    setComposer("");
    setMessageType("text");
    setChatFile(null);
    await loadMessages(selectedConversation.id);
    await loadConversations();
  }

  async function onSendMessage() {
    if (chatBackend === "conversation") {
      await onSendConversationMessage();
      return;
    }
    await onSendLegacyMessage();
  }

  async function copyText(value: string, okMessage: string) {
    await navigator.clipboard.writeText(value);
    setLinkFeedback(okMessage);
    window.setTimeout(() => setLinkFeedback(""), 2500);
  }

  async function onCopyPortalLink() {
    try {
      await copyText(portalAuthLink, "Link de autenticacao copiado.");
    } catch (_error) {
      setLinkFeedback("Nao foi possivel copiar o link.");
      window.setTimeout(() => setLinkFeedback(""), 2500);
    }
  }

  async function onCopyPortalMessage() {
    const message =
      "Ola!\nSegue o acesso ao Portal do Cliente:\n" +
      `${portalAuthLink}\n` +
      "Acesse com CPF e os ultimos 6 digitos do telefone cadastrado.";
    try {
      await copyText(message, "Mensagem pronta copiada.");
    } catch (_error) {
      setLinkFeedback("Nao foi possivel copiar a mensagem.");
      window.setTimeout(() => setLinkFeedback(""), 2500);
    }
  }

  function applyMacro() {
    if (!macroId) return;
    const selected = macros.find((item) => item.id === macroId);
    if (!selected) return;
    setComposer(selected.body);
  }

  if (loading) {
    return <div className="app">Carregando...</div>;
  }

  if (!agentId) {
    return (
      <div className="app">
        <form className="auth-card" onSubmit={onLogin}>
          <h2>CRM DIAMANTE</h2>
          <p>Login do time interno (CRM principal).</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agente@diamante.com.br" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha"
            type="password"
          />
          {authError ? <p>{authError}</p> : null}
          <button className="primary" type="submit">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <h2>CRM DIAMANTE (Principal)</h2>
        <button onClick={onLogout}>Sair</button>
      </div>

      <div className="card">
        <h3>Portal do Cliente (app dentro do CRM)</h3>
        <p>Envie este link para o cliente entrar no Portal.</p>
        <input value={portalAuthLink} readOnly />
        <div className="row">
          <button className="secondary" onClick={onCopyPortalLink}>Copiar link</button>
          <button className="secondary" onClick={onCopyPortalMessage}>Copiar mensagem pronta</button>
          <button
            className="secondary"
            onClick={() => window.open(portalAuthLink, "_blank", "noopener,noreferrer")}
          >
            Ir para autenticacao do portal
          </button>
        </div>
        {linkFeedback ? <small>{linkFeedback}</small> : null}
      </div>

      <div className="card row">
        <div>
          <label>Status</label>
          <div className="row">
            {STATUS_TABS.map((status) => (
              <button key={status} className={tab === status ? "primary" : ""} onClick={() => setTab(status)}>
                {status}
              </button>
            ))}
          </div>
        </div>

        <div style={{ minWidth: 180 }}>
          <label>Atribuicao</label>
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value as "all" | "me" | "unassigned")}>
            <option value="all">all</option>
            <option value="me">me</option>
            <option value="unassigned">unassigned</option>
          </select>
        </div>

        <div style={{ minWidth: 180 }}>
          <label>Prioridade</label>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">all</option>
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <label>Busca</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="contrato/cliente/cpf/unidade/empreendimento"
          />
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <h3>Conversas</h3>
          <div className="inbox-list">
            {filteredConversations.map((item) => (
              <button
                key={item.id}
                className="conv-item"
                onClick={() => setSelectedId(item.id)}
                style={{ textAlign: "left" }}
              >
                <div>
                  <strong>{item.contract_number}</strong> • {item.client_name || "Cliente"}
                </div>
                <div>CPF: {item.client_cpf || "-"}</div>
                <div>
                  {item.contract?.development_name} / {item.contract?.unit_label}
                </div>
                <div>
                  {item.status} • {item.priority} • {item.assigned_agent_id ? "assigned" : "unassigned"}
                </div>
                {item.legacyThread ? <small>Protocolo: {item.legacyThread.protocol}</small> : null}
                <small>{new Date(item.last_message_at).toLocaleString()}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          {!selectedConversation ? (
            <p>Selecione uma conversa.</p>
          ) : (
            <>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>
                  {selectedConversation.contract_number} • {selectedConversation.client_name}
                </h3>
                <button onClick={onAssignToMe}>Assign to me</button>
              </div>

              {selectedConversation.legacyThread ? (
                <small>
                  Protocolo: {selectedConversation.legacyThread.protocol} • Assunto: {selectedConversation.legacyThread.subject}
                </small>
              ) : null}

              <div className="row">
                <div style={{ minWidth: 180 }}>
                  <label>Status</label>
                  <select
                    value={selectedConversation.status}
                    onChange={(e) => onUpdateStatus(e.target.value as ConversationStatus)}
                  >
                    {STATUS_TABS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 180 }}>
                  <label>Prioridade</label>
                  <select
                    value={selectedConversation.priority}
                    onChange={(e) => onUpdatePriority(e.target.value)}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="messages">
                {messages.map((msg) => (
                  <div key={msg.id} className={`msg ${msg.message_type === "note" ? "note" : ""}`}>
                    <div>
                      <strong>{msg.sender_type}</strong> • {msg.message_type} • {new Date(msg.created_at).toLocaleString()}
                    </div>
                    <div>{msg.body_text || "[anexo]"}</div>
                    {msg.legacyAttachments && msg.legacyAttachments.length > 0 ? (
                      <div className="row" style={{ marginTop: 8 }}>
                        {msg.legacyAttachments.map((attachment, index) => (
                          <a
                            key={`${msg.id}-${index}`}
                            href={attachment.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="secondary"
                            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                          >
                            {attachment.name || "Anexo"}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {msg.sender_type === "client" ? (
                      <small>{msg.read_at_agent ? "Lida pelo atendimento" : "Enviada pelo cliente"}</small>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="row">
                <div style={{ minWidth: 220 }}>
                  <label>Macros</label>
                  <select value={macroId} onChange={(e) => setMacroId(e.target.value)}>
                    <option value="">Selecione macro</option>
                    {macros.map((macro) => (
                      <option key={macro.id} value={macro.id}>
                        {macro.title}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={applyMacro}>Aplicar macro</button>
              </div>

              <div className="row">
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as "text" | "note")}
                  style={{ maxWidth: 220 }}
                  disabled={chatBackend !== "conversation"}
                >
                  <option value="text">text</option>
                  <option value="note">note (interna)</option>
                </select>
                <input type="file" onChange={(e) => setChatFile(e.target.files?.[0] || null)} />
              </div>

              <textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Escreva a resposta" />
              <button className="primary" onClick={onSendMessage}>
                Enviar
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
