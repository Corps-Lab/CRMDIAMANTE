import { supabase } from "@/integrations/supabase/client";
import { isOnlineRuntime } from "@/lib/runtime";
import { safeId } from "@/lib/safeId";
import type {
  CreatePortalTicketInput,
  CreatePortalTicketResult,
  PortalChatAttachment,
  PortalChatMessage,
  PortalChatThread,
  PortalThreadStatus,
  PortalTicketOpenResult,
  SupportThreadSummary,
} from "@/types/portalChat";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

type AttachmentUploadPayload = {
  name: string;
  type: string;
  size: number;
  contentBase64: string;
};

type MockThreadRow = {
  id: string;
  protocol: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientDocument: string | null;
  subject: string;
  status: PortalThreadStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};

type MockAccessRow = {
  threadId: string;
  accessKey: string;
};

type MockMessageRow = PortalChatMessage & {
  readBySupport?: boolean;
  readByClient?: boolean;
};

function cleanProtocol(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function cleanAccessKey(value: string) {
  return String(value || "").trim().toUpperCase();
}

function normalizePhone(raw?: string | null) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizeDocument(raw?: string | null) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits || null;
}

function makeProtocol() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `DIA-${y}${m}${d}-${random}`;
}

function makeAccessKey(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let next = "";
  for (let index = 0; index < length; index += 1) {
    next += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return next;
}

function keyThreads(agencyId: string) {
  return `crm_${agencyId}_portal_chat_threads`;
}

function keyMessages(agencyId: string) {
  return `crm_${agencyId}_portal_chat_messages`;
}

function keyAccess(agencyId: string) {
  return `crm_${agencyId}_portal_chat_access`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures on older browsers/private tabs
  }
}

function readMockThreads(agencyId: string) {
  return readJson<MockThreadRow[]>(keyThreads(agencyId), []);
}

function readMockAccess(agencyId: string) {
  return readJson<MockAccessRow[]>(keyAccess(agencyId), []);
}

function readMockMessages(agencyId: string) {
  const rows = readJson<MockMessageRow[]>(keyMessages(agencyId), []);
  return rows.map((row) => ({
    ...row,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    readBySupport: Boolean(row.readBySupport),
    readByClient: Boolean(row.readByClient),
  }));
}

function persistMockData(
  agencyId: string,
  threads: MockThreadRow[],
  access: MockAccessRow[],
  messages: MockMessageRow[],
) {
  writeJson(keyThreads(agencyId), threads);
  writeJson(keyAccess(agencyId), access);
  writeJson(keyMessages(agencyId), messages);
}

function invokePortalFunction(body: Record<string, unknown>) {
  return supabase.functions.invoke("portal-chat", { body });
}

function inferAttachmentKind(type: string): PortalChatAttachment["kind"] {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

function toPortalAttachment(raw: unknown): PortalChatAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const url = String(value.url || "").trim();
  if (!url) return null;
  const type = String(value.type || "application/octet-stream");
  return {
    name: String(value.name || "arquivo"),
    type,
    size: Number(value.size || 0),
    path: String(value.path || "") || null,
    url,
    kind: (value.kind as PortalChatAttachment["kind"]) || inferAttachmentKind(type),
  };
}

function normalizeAttachments(raw: unknown): PortalChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => toPortalAttachment(item))
    .filter((item): item is PortalChatAttachment => Boolean(item));
}

function mapDbThread(row: Record<string, unknown>): PortalChatThread {
  return {
    id: String(row.id || ""),
    protocol: String(row.protocol || ""),
    clientName: String(row.client_name || ""),
    clientEmail: (row.client_email as string | null) || null,
    clientPhone: (row.client_phone as string | null) || null,
    clientDocument: (row.client_document as string | null) || null,
    subject: String(row.subject || ""),
    status: (row.status as PortalThreadStatus) || "aberto",
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    lastMessageAt: String(row.last_message_at || row.updated_at || new Date().toISOString()),
  };
}

function mapDbMessage(row: Record<string, unknown>): PortalChatMessage {
  return {
    id: String(row.id || ""),
    threadId: String(row.thread_id || ""),
    senderType: (row.sender_type as PortalChatMessage["senderType"]) || "sistema",
    senderName: (row.sender_name as string | null) || null,
    channel: (row.channel as PortalChatMessage["channel"]) || "portal",
    message: String(row.message || ""),
    attachments: normalizeAttachments(row.attachments),
    readBySupport: Boolean(row.read_by_support),
    readByClient: Boolean(row.read_by_client),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function parsePortalResult<T>(payload: unknown): T {
  const typed = (payload || {}) as { ok?: boolean; error?: string; data?: unknown };
  if (!typed.ok) throw new Error(typed.error || "Falha ao comunicar com o portal.");
  return typed.data as T;
}

function findThreadByAccess(
  agencyId: string,
  protocolRaw: string,
  accessKeyRaw: string,
) {
  const protocol = cleanProtocol(protocolRaw);
  const accessKey = cleanAccessKey(accessKeyRaw);
  const threads = readMockThreads(agencyId);
  const accessRows = readMockAccess(agencyId);
  const thread = threads.find((item) => item.protocol === protocol);
  if (!thread) return null;
  const access = accessRows.find((item) => item.threadId === thread.id);
  if (!access || access.accessKey !== accessKey) return null;
  return thread;
}

function sortByDateAsc(messages: PortalChatMessage[]) {
  return [...messages].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function sortThreadsByLastMessage(threads: PortalChatThread[]) {
  return [...threads].sort((a, b) => {
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo local."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao processar arquivo."));
    reader.onload = () => {
      const value = String(reader.result || "");
      const base64 = value.includes(",") ? value.split(",")[1] : value;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

function sanitizeFiles(files?: File[]) {
  if (!files || files.length === 0) return [];
  const selected = files.slice(0, MAX_ATTACHMENTS);
  selected.forEach((file) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Arquivo ${file.name} excede 20MB.`);
    }
  });
  return selected;
}

async function toUploadPayload(files?: File[]): Promise<AttachmentUploadPayload[]> {
  const valid = sanitizeFiles(files);
  const payloads = await Promise.all(
    valid.map(async (file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      contentBase64: await fileToBase64(file),
    })),
  );
  return payloads;
}

async function toMockAttachments(files?: File[]): Promise<PortalChatAttachment[]> {
  const valid = sanitizeFiles(files);
  const output = await Promise.all(
    valid.map(async (file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      path: null,
      url: await fileToDataUrl(file),
      kind: inferAttachmentKind(file.type || ""),
    })),
  );
  return output;
}

export async function createPortalTicket(
  input: CreatePortalTicketInput,
  agencyId = "diamante",
): Promise<CreatePortalTicketResult> {
  if (isOnlineRuntime) {
    const { data, error } = await invokePortalFunction({
      action: "create_ticket",
      ...input,
      attachments: await toUploadPayload(input.attachments),
    });
    if (error) throw new Error(error.message || "Falha ao abrir atendimento.");
    return parsePortalResult<CreatePortalTicketResult>(data);
  }

  const now = new Date().toISOString();
  const threads = readMockThreads(agencyId);
  const accessRows = readMockAccess(agencyId);
  const messages = readMockMessages(agencyId);

  let protocol = makeProtocol();
  while (threads.some((thread) => thread.protocol === protocol)) {
    protocol = makeProtocol();
  }

  const accessKey = makeAccessKey(8);
  const threadId = safeId("portal-thread");
  const thread: MockThreadRow = {
    id: threadId,
    protocol,
    clientName: input.clientName.trim(),
    clientEmail: (input.clientEmail || "").trim().toLowerCase() || null,
    clientPhone: normalizePhone(input.clientPhone),
    clientDocument: normalizeDocument(input.clientDocument),
    subject: input.subject.trim(),
    status: "aberto",
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };

  const firstMessage: MockMessageRow = {
    id: safeId("portal-message"),
    threadId,
    senderType: "cliente",
    senderName: thread.clientName,
    channel: "portal",
    message: input.message.trim(),
    attachments: await toMockAttachments(input.attachments),
    createdAt: now,
    readBySupport: false,
    readByClient: true,
  };

  persistMockData(
    agencyId,
    [thread, ...threads],
    [...accessRows, { threadId, accessKey }],
    [...messages, firstMessage],
  );

  return {
    protocol,
    accessKey,
    thread,
    messages: [firstMessage],
  };
}

export async function openPortalTicket(
  protocol: string,
  accessKey: string,
  agencyId = "diamante",
): Promise<PortalTicketOpenResult> {
  if (isOnlineRuntime) {
    const { data, error } = await invokePortalFunction({
      action: "open_ticket",
      protocol,
      accessKey,
    });
    if (error) throw new Error(error.message || "Falha ao abrir atendimento.");
    return parsePortalResult<PortalTicketOpenResult>(data);
  }

  const thread = findThreadByAccess(agencyId, protocol, accessKey);
  if (!thread) throw new Error("Protocolo ou chave de acesso invalidos.");

  const messages = sortByDateAsc(
    readMockMessages(agencyId).filter((message) => message.threadId === thread.id),
  );
  const markedRead = messages.map((message) =>
    message.senderType === "suporte"
      ? ({ ...message, readByClient: true } as PortalChatMessage)
      : message,
  );
  persistMockData(
    agencyId,
    readMockThreads(agencyId),
    readMockAccess(agencyId),
    markedRead as MockMessageRow[],
  );
  return { thread, messages: markedRead };
}

export async function listPortalMessages(
  protocol: string,
  accessKey: string,
  since?: string | null,
  agencyId = "diamante",
): Promise<PortalTicketOpenResult> {
  if (isOnlineRuntime) {
    const { data, error } = await invokePortalFunction({
      action: "list_messages",
      protocol,
      accessKey,
      since: since || null,
    });
    if (error) throw new Error(error.message || "Falha ao atualizar mensagens.");
    return parsePortalResult<PortalTicketOpenResult>(data);
  }

  const thread = findThreadByAccess(agencyId, protocol, accessKey);
  if (!thread) throw new Error("Protocolo ou chave de acesso invalidos.");

  const storedMessages = readMockMessages(agencyId).filter(
    (message) => message.threadId === thread.id,
  );
  const readMarkedMessages = storedMessages.map((message) =>
    message.senderType === "suporte"
      ? ({ ...message, readByClient: true } as MockMessageRow)
      : message,
  );
  const otherMessages = readMockMessages(agencyId).filter(
    (message) => message.threadId !== thread.id,
  );
  persistMockData(
    agencyId,
    readMockThreads(agencyId),
    readMockAccess(agencyId),
    [...otherMessages, ...readMarkedMessages],
  );
  const allMessages = sortByDateAsc(readMarkedMessages);
  const filtered = since
    ? allMessages.filter((message) => new Date(message.createdAt) > new Date(since))
    : allMessages;

  return { thread, messages: filtered };
}

export async function sendPortalMessage(
  protocol: string,
  accessKey: string,
  messageRaw: string,
  senderName?: string | null,
  agencyId = "diamante",
  attachments?: File[],
): Promise<PortalChatMessage> {
  const message = String(messageRaw || "").trim();
  const uploadPayload = await toUploadPayload(attachments);
  if (!message && uploadPayload.length === 0) {
    throw new Error("Envie texto ou anexo.");
  }

  if (isOnlineRuntime) {
    const { data, error } = await invokePortalFunction({
      action: "send_message",
      protocol,
      accessKey,
      message,
      senderName: senderName || null,
      attachments: uploadPayload,
    });
    if (error) throw new Error(error.message || "Falha ao enviar mensagem.");
    const parsed = parsePortalResult<{ message: PortalChatMessage }>(data);
    return parsed.message;
  }

  const thread = findThreadByAccess(agencyId, protocol, accessKey);
  if (!thread) throw new Error("Protocolo ou chave de acesso invalidos.");

  const now = new Date().toISOString();
  const nextMessage: MockMessageRow = {
    id: safeId("portal-message"),
    threadId: thread.id,
    senderType: "cliente",
    senderName: senderName || thread.clientName,
    channel: "portal",
    message,
    attachments: await toMockAttachments(attachments),
    createdAt: now,
    readBySupport: false,
    readByClient: true,
  };

  const threads = readMockThreads(agencyId).map((item) =>
    item.id === thread.id
      ? {
          ...item,
          status:
            item.status === "fechado" || item.status === "resolvido"
              ? "aberto"
              : item.status,
          updatedAt: now,
          lastMessageAt: now,
        }
      : item,
  );
  const accessRows = readMockAccess(agencyId);
  const messages = [...readMockMessages(agencyId), nextMessage];
  persistMockData(agencyId, threads, accessRows, messages);
  return nextMessage;
}

export async function closePortalTicket(
  protocol: string,
  accessKey: string,
  agencyId = "diamante",
) {
  if (isOnlineRuntime) {
    const { data, error } = await invokePortalFunction({
      action: "close_ticket",
      protocol,
      accessKey,
    });
    if (error) throw new Error(error.message || "Falha ao fechar atendimento.");
    const parsed = parsePortalResult<{ thread: PortalChatThread }>(data);
    return parsed.thread;
  }

  const thread = findThreadByAccess(agencyId, protocol, accessKey);
  if (!thread) throw new Error("Protocolo ou chave de acesso invalidos.");
  const now = new Date().toISOString();
  const threads = readMockThreads(agencyId).map((item) =>
    item.id === thread.id ? { ...item, status: "fechado", updatedAt: now } : item,
  );
  const accessRows = readMockAccess(agencyId);
  const messages = readMockMessages(agencyId);
  persistMockData(agencyId, threads, accessRows, messages);
  return threads.find((item) => item.id === thread.id) || thread;
}

export async function listSupportThreads(
  agencyId = "diamante",
): Promise<SupportThreadSummary[]> {
  if (isOnlineRuntime) {
    const [{ data: threadRows, error: threadError }, unreadResult] = await Promise.all([
      supabase
        .from("portal_chat_threads")
        .select("*")
        .order("last_message_at", { ascending: false }),
      supabase
        .from("portal_chat_messages")
        .select("id, thread_id")
        .eq("sender_type", "cliente")
        .eq("read_by_support", false),
    ]);

    if (threadError) {
      throw new Error(threadError.message || "Falha ao carregar atendimentos.");
    }
    if (unreadResult.error) {
      throw new Error(unreadResult.error.message || "Falha ao carregar mensagens.");
    }

    const unreadMap = new Map<string, number>();
    (unreadResult.data || []).forEach((row) => {
      const threadId = String((row as Record<string, unknown>).thread_id || "");
      unreadMap.set(threadId, (unreadMap.get(threadId) || 0) + 1);
    });

    return (threadRows || []).map((row) => {
      const mapped = mapDbThread(row as Record<string, unknown>);
      return {
        ...mapped,
        unreadBySupport: unreadMap.get(mapped.id) || 0,
      };
    });
  }

  const threads = readMockThreads(agencyId);
  const messages = readMockMessages(agencyId);
  const unreadMap = new Map<string, number>();

  messages.forEach((message) => {
    if (message.senderType !== "cliente") return;
    if (message.readBySupport === false) {
      unreadMap.set(message.threadId, (unreadMap.get(message.threadId) || 0) + 1);
    }
  });

  const mapped = threads.map((thread) => ({
    ...thread,
    unreadBySupport: unreadMap.get(thread.id) || 0,
  }));

  return sortThreadsByLastMessage(mapped);
}

export async function getSupportThreadMessages(
  threadId: string,
  agencyId = "diamante",
): Promise<PortalChatMessage[]> {
  if (isOnlineRuntime) {
    const { data, error } = await supabase
      .from("portal_chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message || "Falha ao carregar conversa.");
    return (data || []).map((row) => mapDbMessage(row as Record<string, unknown>));
  }

  return sortByDateAsc(
    readMockMessages(agencyId).filter((message) => message.threadId === threadId),
  );
}

export async function markSupportThreadAsRead(
  threadId: string,
  agencyId = "diamante",
) {
  if (isOnlineRuntime) {
    const { error } = await supabase
      .from("portal_chat_messages")
      .update({ read_by_support: true })
      .eq("thread_id", threadId)
      .eq("sender_type", "cliente")
      .eq("read_by_support", false);
    if (error) throw new Error(error.message || "Falha ao marcar conversa como lida.");
    return;
  }

  const threads = readMockThreads(agencyId);
  const accessRows = readMockAccess(agencyId);
  const messages = readMockMessages(agencyId).map((message) => {
    if (message.threadId !== threadId || message.senderType !== "cliente") return message;
    return { ...message, readBySupport: true } as MockMessageRow;
  });
  persistMockData(agencyId, threads, accessRows, messages);
}

export async function sendSupportMessage(
  threadId: string,
  messageRaw: string,
  options?: {
    senderName?: string | null;
    senderUserId?: string | null;
    attachments?: File[];
  },
  agencyId = "diamante",
): Promise<PortalChatMessage> {
  const message = String(messageRaw || "").trim();
  const uploadPayload = await toUploadPayload(options?.attachments);
  if (!message && uploadPayload.length === 0) {
    throw new Error("Envie texto ou anexo.");
  }

  if (isOnlineRuntime) {
    const { data, error } = await invokePortalFunction({
      action: "support_send_message",
      threadId,
      message,
      senderName: options?.senderName || "Suporte CRM DIAMANTE",
      attachments: uploadPayload,
    });
    if (error) throw new Error(error.message || "Falha ao enviar resposta.");
    const parsed = parsePortalResult<{ message: PortalChatMessage }>(data);
    return parsed.message;
  }

  const now = new Date().toISOString();
  const nextMessage: MockMessageRow = {
    id: safeId("portal-message"),
    threadId,
    senderType: "suporte",
    senderName: options?.senderName || "Suporte CRM DIAMANTE",
    channel: "portal",
    message,
    attachments: await toMockAttachments(options?.attachments),
    createdAt: now,
    readBySupport: true,
    readByClient: false,
  };

  const threads = readMockThreads(agencyId).map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          status:
            thread.status === "aberto" || thread.status === "em_atendimento"
              ? "aguardando_cliente"
              : thread.status,
          updatedAt: now,
          lastMessageAt: now,
        }
      : thread,
  );
  const accessRows = readMockAccess(agencyId);
  const messages = [...readMockMessages(agencyId), nextMessage];
  persistMockData(agencyId, threads, accessRows, messages);
  return nextMessage;
}

export async function updateSupportThreadStatus(
  threadId: string,
  status: PortalThreadStatus,
  agencyId = "diamante",
) {
  if (isOnlineRuntime) {
    const { data, error } = await supabase
      .from("portal_chat_threads")
      .update({ status })
      .eq("id", threadId)
      .select("*")
      .single();
    if (error) throw new Error(error.message || "Falha ao atualizar status.");
    return mapDbThread(data as Record<string, unknown>);
  }

  const now = new Date().toISOString();
  const threads = readMockThreads(agencyId).map((thread) =>
    thread.id === threadId ? { ...thread, status, updatedAt: now } : thread,
  );
  const accessRows = readMockAccess(agencyId);
  const messages = readMockMessages(agencyId);
  persistMockData(agencyId, threads, accessRows, messages);
  const found = threads.find((thread) => thread.id === threadId);
  if (!found) throw new Error("Atendimento nao encontrado.");
  return found;
}
