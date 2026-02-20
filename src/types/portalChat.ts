export type PortalThreadStatus =
  | "aberto"
  | "em_atendimento"
  | "aguardando_cliente"
  | "resolvido"
  | "fechado";

export type PortalSenderType = "cliente" | "suporte" | "sistema";

export type PortalAttachmentKind = "image" | "video" | "audio" | "file";

export interface PortalChatAttachment {
  name: string;
  type: string;
  size: number;
  path?: string | null;
  url: string;
  kind: PortalAttachmentKind;
}

export interface PortalChatThread {
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
}

export interface PortalChatMessage {
  id: string;
  threadId: string;
  senderType: PortalSenderType;
  senderName: string | null;
  channel: "portal" | "whatsapp" | "interno";
  message: string;
  attachments: PortalChatAttachment[];
  readBySupport: boolean;
  readByClient: boolean;
  createdAt: string;
}

export interface PortalTicketOpenResult {
  thread: PortalChatThread;
  messages: PortalChatMessage[];
}

export interface SupportThreadSummary extends PortalChatThread {
  unreadBySupport: number;
}

export interface CreatePortalTicketInput {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientDocument?: string;
  subject: string;
  message: string;
  attachments?: File[];
}

export interface CreatePortalTicketResult extends PortalTicketOpenResult {
  protocol: string;
  accessKey: string;
}
