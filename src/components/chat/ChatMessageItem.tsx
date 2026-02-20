import type { PortalChatMessage, PortalSenderType } from "@/types/portalChat";
import { ChatAttachments } from "@/components/chat/ChatAttachments";
import { CheckCheck } from "lucide-react";

interface ChatMessageItemProps {
  message: PortalChatMessage;
  currentSenderType: PortalSenderType;
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toInitial(name: string | null) {
  const value = (name || "").trim();
  if (!value) return "?";
  return value[0].toUpperCase();
}

export function ChatMessageItem({ message, currentSenderType }: ChatMessageItemProps) {
  const isMine = message.senderType === currentSenderType;
  const peerRead = isMine
    ? currentSenderType === "suporte"
      ? message.readByClient
      : message.readBySupport
    : false;

  return (
    <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
      {!isMine ? (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
          {toInitial(message.senderName)}
        </div>
      ) : null}
      <div
        className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
          isMine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border bg-muted text-foreground"
        }`}
      >
        {message.message ? <p className="whitespace-pre-wrap">{message.message}</p> : null}
        <ChatAttachments attachments={message.attachments} />
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
            isMine ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          <span>{formatHour(message.createdAt)}</span>
          {isMine ? (
            <CheckCheck className={`h-3.5 w-3.5 ${peerRead ? "text-sky-400" : ""}`} />
          ) : null}
        </div>
      </div>
      {isMine ? (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold text-black">
          {toInitial(message.senderName)}
        </div>
      ) : null}
    </div>
  );
}
