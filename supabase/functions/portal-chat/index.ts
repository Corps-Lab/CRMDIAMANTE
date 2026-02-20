import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

type PortalAction =
  | "create_ticket"
  | "open_ticket"
  | "list_messages"
  | "send_message"
  | "support_send_message"
  | "close_ticket";

type PortalThreadRow = {
  id: string;
  protocol: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_document: string | null;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
};

type PortalMessageRow = {
  id: string;
  thread_id: string;
  sender_type: string;
  sender_name: string | null;
  channel: string;
  message: string;
  attachments: unknown;
  read_by_support: boolean;
  read_by_client: boolean;
  created_at: string;
};

type AttachmentUploadInput = {
  name: string;
  type: string;
  size: number;
  contentBase64: string;
};

type StoredAttachment = {
  name: string;
  type: string;
  size: number;
  path: string;
  url: string;
  kind: "image" | "video" | "audio" | "file";
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeProtocol(raw: unknown) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function normalizeDocument(raw: unknown) {
  return String(raw || "").replace(/\D/g, "");
}

function normalizePhone(raw: unknown) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizeEmail(raw: unknown) {
  const value = String(raw || "").trim().toLowerCase();
  return value || null;
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
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => alphabet[value % alphabet.length])
    .join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function inferAttachmentKind(type: string): StoredAttachment["kind"] {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

function sanitizeFilename(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return clean || "arquivo";
}

function parseAttachments(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_ATTACHMENTS).map((item) => {
    const value = (item || {}) as Record<string, unknown>;
    return {
      name: String(value.name || "arquivo"),
      type: String(value.type || "application/octet-stream"),
      size: Number(value.size || 0),
      contentBase64: String(value.contentBase64 || ""),
    } as AttachmentUploadInput;
  });
}

function base64ToBytes(value: string) {
  const normalized = value.includes(",") ? value.split(",")[1] : value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function uploadAttachments(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  threadId: string,
  senderType: "cliente" | "suporte",
  rawAttachments: unknown,
) {
  const parsed = parseAttachments(rawAttachments);
  const uploaded: StoredAttachment[] = [];

  for (const attachment of parsed) {
    if (!attachment.contentBase64) continue;
    const bytes = base64ToBytes(attachment.contentBase64);
    const declaredSize = Number(attachment.size || 0);
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES || declaredSize > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Arquivo ${attachment.name} excede 20MB.`);
    }

    const filename = sanitizeFilename(attachment.name);
    const path = `${threadId}/${senderType}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    const contentType = attachment.type || "application/octet-stream";

    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, bytes, {
        contentType,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message || "Falha no upload de anexo.");

    const publicUrl = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    uploaded.push({
      name: attachment.name,
      type: contentType,
      size: declaredSize || bytes.byteLength,
      path,
      url: publicUrl,
      kind: inferAttachmentKind(contentType),
    });
  }

  return uploaded;
}

function mapThread(thread: PortalThreadRow) {
  return {
    id: thread.id,
    protocol: thread.protocol,
    clientName: thread.client_name,
    clientEmail: thread.client_email,
    clientPhone: thread.client_phone,
    clientDocument: thread.client_document,
    subject: thread.subject,
    status: thread.status,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    lastMessageAt: thread.last_message_at,
  };
}

function mapMessage(message: PortalMessageRow) {
  return {
    id: message.id,
    threadId: message.thread_id,
    senderType: message.sender_type,
    senderName: message.sender_name,
    channel: message.channel,
    message: message.message,
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    readBySupport: Boolean(message.read_by_support),
    readByClient: Boolean(message.read_by_client),
    createdAt: message.created_at,
  };
}

async function getThreadByProtocol(
  admin: ReturnType<typeof createClient>,
  protocol: string,
) {
  const { data, error } = await admin
    .from("portal_chat_threads")
    .select("*")
    .eq("protocol", protocol)
    .maybeSingle<PortalThreadRow>();

  if (error) throw error;
  return data;
}

async function getMessages(
  admin: ReturnType<typeof createClient>,
  threadId: string,
  since?: string | null,
) {
  let query = admin
    .from("portal_chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (since) query = query.gt("created_at", since);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PortalMessageRow[];
}

async function validatePortalAccess(
  admin: ReturnType<typeof createClient>,
  protocolRaw: unknown,
  accessKeyRaw: unknown,
) {
  const protocol = normalizeProtocol(protocolRaw);
  const accessKey = String(accessKeyRaw || "").trim().toUpperCase();

  if (!protocol || !accessKey) {
    throw new Error("Protocolo e chave de acesso sao obrigatorios.");
  }

  const thread = await getThreadByProtocol(admin, protocol);
  if (!thread) throw new Error("Protocolo nao encontrado.");

  const { data: accessRow, error: accessError } = await admin
    .from("portal_chat_access_keys")
    .select("thread_id, access_key_hash, expires_at")
    .eq("thread_id", thread.id)
    .maybeSingle<{ thread_id: string; access_key_hash: string; expires_at: string | null }>();

  if (accessError) throw accessError;
  if (!accessRow) throw new Error("Chave de acesso invalida.");

  const keyHash = await sha256Hex(accessKey);
  if (keyHash !== accessRow.access_key_hash) {
    throw new Error("Chave de acesso invalida.");
  }

  if (accessRow.expires_at && new Date(accessRow.expires_at) < new Date()) {
    throw new Error("Chave de acesso expirada.");
  }

  await admin
    .from("portal_chat_access_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("thread_id", thread.id);

  return thread;
}

async function validateSupportAccess(
  admin: ReturnType<typeof createClient>,
  req: Request,
) {
  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : "";
  if (!bearerToken) throw new Error("Sessao invalida.");

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(bearerToken);
  if (userError || !user) throw new Error("Sessao invalida.");

  const { data: canSupport, error: roleError } = await admin.rpc("can_access", {
    _permission: "suporte",
    _user_id: user.id,
  });
  if (roleError) throw roleError;
  if (!canSupport) throw new Error("Sem permissao para responder atendimentos.");

  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bucket = Deno.env.get("PORTAL_CHAT_BUCKET") ?? "portal-chat";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "") as PortalAction;

    if (!action) {
      return jsonResponse(400, { ok: false, error: "Acao obrigatoria." });
    }

    if (action === "create_ticket") {
      const clientName = String(body.clientName || "").trim();
      const subject = String(body.subject || "").trim();
      const message = String(body.message || "").trim();
      const attachments = parseAttachments(body.attachments);

      if (!clientName || !subject || (!message && attachments.length === 0)) {
        return jsonResponse(400, {
          ok: false,
          error: "Nome, assunto e texto/anexo inicial sao obrigatorios.",
        });
      }

      const clientEmail = normalizeEmail(body.clientEmail);
      const clientPhone = normalizePhone(body.clientPhone);
      const clientDocument = normalizeDocument(body.clientDocument) || null;
      const accessKey = makeAccessKey(8);
      const accessKeyHash = await sha256Hex(accessKey);

      let thread: PortalThreadRow | null = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const protocol = makeProtocol();
        const { data, error } = await admin
          .from("portal_chat_threads")
          .insert({
            protocol,
            client_name: clientName,
            client_email: clientEmail,
            client_phone: clientPhone,
            client_document: clientDocument,
            subject,
            status: "aberto",
            origin: "portal",
          })
          .select("*")
          .single<PortalThreadRow>();

        if (!error && data) {
          thread = data;
          break;
        }

        const code = (error as { code?: string } | null)?.code;
        if (code !== "23505") throw error;
      }

      if (!thread) {
        return jsonResponse(500, {
          ok: false,
          error: "Nao foi possivel gerar protocolo unico.",
        });
      }

      const { error: accessError } = await admin.from("portal_chat_access_keys").insert({
        thread_id: thread.id,
        access_key_hash: accessKeyHash,
      });
      if (accessError) throw accessError;

      const storedAttachments = await uploadAttachments(
        admin,
        bucket,
        thread.id,
        "cliente",
        attachments,
      );

      const { error: messageError } = await admin.from("portal_chat_messages").insert({
        thread_id: thread.id,
        sender_type: "cliente",
        sender_name: clientName,
        channel: "portal",
        message,
        attachments: storedAttachments,
        read_by_client: true,
        read_by_support: false,
      });
      if (messageError) throw messageError;

      const messages = await getMessages(admin, thread.id);

      return jsonResponse(200, {
        ok: true,
        data: {
          protocol: thread.protocol,
          accessKey,
          thread: mapThread(thread),
          messages: messages.map(mapMessage),
        },
      });
    }

    if (action === "open_ticket") {
      const thread = await validatePortalAccess(admin, body.protocol, body.accessKey);
      await admin
        .from("portal_chat_messages")
        .update({ read_by_client: true })
        .eq("thread_id", thread.id)
        .eq("sender_type", "suporte")
        .eq("read_by_client", false);
      const messages = await getMessages(admin, thread.id);

      return jsonResponse(200, {
        ok: true,
        data: {
          thread: mapThread(thread),
          messages: messages.map(mapMessage),
        },
      });
    }

    if (action === "list_messages") {
      const thread = await validatePortalAccess(admin, body.protocol, body.accessKey);
      const since = String(body.since || "").trim() || null;

      await admin
        .from("portal_chat_messages")
        .update({ read_by_client: true })
        .eq("thread_id", thread.id)
        .eq("sender_type", "suporte")
        .eq("read_by_client", false);
      const messages = await getMessages(admin, thread.id, since);

      return jsonResponse(200, {
        ok: true,
        data: {
          thread: mapThread(thread),
          messages: messages.map(mapMessage),
        },
      });
    }

    if (action === "send_message") {
      const thread = await validatePortalAccess(admin, body.protocol, body.accessKey);
      const message = String(body.message || "").trim();
      const attachments = parseAttachments(body.attachments);
      if (!message && attachments.length === 0) {
        return jsonResponse(400, { ok: false, error: "Envie texto ou anexo." });
      }

      const senderName = String(body.senderName || "").trim() || thread.client_name;
      const storedAttachments = await uploadAttachments(
        admin,
        bucket,
        thread.id,
        "cliente",
        attachments,
      );

      const { data: inserted, error: insertError } = await admin
        .from("portal_chat_messages")
        .insert({
          thread_id: thread.id,
          sender_type: "cliente",
          sender_name: senderName,
          channel: "portal",
          message,
          attachments: storedAttachments,
          read_by_client: true,
          read_by_support: false,
        })
        .select("*")
        .single<PortalMessageRow>();
      if (insertError) throw insertError;

      return jsonResponse(200, {
        ok: true,
        data: {
          thread: mapThread(thread),
          message: mapMessage(inserted),
        },
      });
    }

    if (action === "support_send_message") {
      const user = await validateSupportAccess(admin, req);
      const threadId = String(body.threadId || "").trim();
      const message = String(body.message || "").trim();
      const attachments = parseAttachments(body.attachments);

      if (!threadId || (!message && attachments.length === 0)) {
        return jsonResponse(400, {
          ok: false,
          error: "Thread e texto/anexo sao obrigatorios.",
        });
      }

      const { data: thread, error: threadError } = await admin
        .from("portal_chat_threads")
        .select("*")
        .eq("id", threadId)
        .maybeSingle<PortalThreadRow>();
      if (threadError) throw threadError;
      if (!thread) return jsonResponse(404, { ok: false, error: "Atendimento nao encontrado." });

      const senderName =
        String(body.senderName || "").trim() ||
        user.user_metadata?.name ||
        user.email ||
        "Suporte CRM DIAMANTE";

      const storedAttachments = await uploadAttachments(
        admin,
        bucket,
        thread.id,
        "suporte",
        attachments,
      );

      const { data: inserted, error: insertError } = await admin
        .from("portal_chat_messages")
        .insert({
          thread_id: thread.id,
          sender_type: "suporte",
          sender_name: senderName,
          sender_user_id: user.id,
          channel: "portal",
          message,
          attachments: storedAttachments,
          read_by_support: true,
          read_by_client: false,
        })
        .select("*")
        .single<PortalMessageRow>();
      if (insertError) throw insertError;

      return jsonResponse(200, {
        ok: true,
        data: {
          thread: mapThread(thread),
          message: mapMessage(inserted),
        },
      });
    }

    if (action === "close_ticket") {
      const thread = await validatePortalAccess(admin, body.protocol, body.accessKey);
      const { data: updated, error: updateError } = await admin
        .from("portal_chat_threads")
        .update({ status: "fechado" })
        .eq("id", thread.id)
        .select("*")
        .single<PortalThreadRow>();
      if (updateError) throw updateError;

      return jsonResponse(200, {
        ok: true,
        data: {
          thread: mapThread(updated),
        },
      });
    }

    return jsonResponse(400, { ok: false, error: "Acao invalida." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return jsonResponse(500, { ok: false, error: message });
  }
});
