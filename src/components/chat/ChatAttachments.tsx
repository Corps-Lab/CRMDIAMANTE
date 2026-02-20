import type { PortalChatAttachment } from "@/types/portalChat";
import { Button } from "@/components/ui/button";
import { File, Mic, Paperclip, Play } from "lucide-react";

interface ChatAttachmentsProps {
  attachments: PortalChatAttachment[];
}

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

interface PendingAttachmentsProps {
  files: PendingAttachment[];
  onRemove: (id: string) => void;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

export function ChatAttachments({ attachments }: ChatAttachmentsProps) {
  if (!attachments.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment, index) => {
        if (attachment.kind === "image") {
          return (
            <a
              key={`${attachment.url}-${index}`}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-border/40"
            >
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-h-64 w-full object-cover"
                loading="lazy"
              />
              <div className="bg-black/40 px-2 py-1 text-[11px] text-muted-foreground">
                {attachment.name}
              </div>
            </a>
          );
        }

        if (attachment.kind === "video") {
          return (
            <div
              key={`${attachment.url}-${index}`}
              className="overflow-hidden rounded-lg border border-border/40 bg-black/30"
            >
              <video
                src={attachment.url}
                controls
                className="max-h-64 w-full bg-black"
                preload="metadata"
              />
              <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground">
                <Play className="h-3 w-3" />
                <span>{attachment.name}</span>
              </div>
            </div>
          );
        }

        if (attachment.kind === "audio") {
          return (
            <div
              key={`${attachment.url}-${index}`}
              className="rounded-lg border border-border/40 bg-background/60 px-2 py-2"
            >
              <audio src={attachment.url} controls className="w-full" preload="metadata" />
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Mic className="h-3 w-3" />
                <span className="truncate">{attachment.name}</span>
                <span>{formatFileSize(attachment.size)}</span>
              </div>
            </div>
          );
        }

        return (
          <a
            key={`${attachment.url}-${index}`}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-2 py-2 text-xs hover:bg-background"
          >
            <File className="h-4 w-4 text-primary" />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
          </a>
        );
      })}
    </div>
  );
}

export function PendingAttachments({
  files,
  onRemove,
}: PendingAttachmentsProps) {
  if (!files.length) return null;

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-border/70 p-2">
      {files.map((item) => {
        const isImage = item.file.type.startsWith("image/");
        const isVideo = item.file.type.startsWith("video/");
        const isAudio = item.file.type.startsWith("audio/");

        return (
          <div
            key={item.id}
            className="relative flex items-center gap-2 rounded-md border border-border bg-background/70 px-2 py-2 text-xs"
          >
            {isImage ? (
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="h-10 w-10 rounded object-cover"
              />
            ) : isVideo ? (
              <div className="grid h-10 w-10 place-items-center rounded bg-black/40">
                <Play className="h-4 w-4 text-primary" />
              </div>
            ) : isAudio ? (
              <div className="grid h-10 w-10 place-items-center rounded bg-black/30">
                <Mic className="h-4 w-4 text-primary" />
              </div>
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded bg-black/30">
                <File className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="max-w-[10rem]">
              <p className="truncate font-medium">{item.file.name}</p>
              <p className="text-muted-foreground">{formatFileSize(item.file.size)}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => onRemove(item.id)}
            >
              remover
            </Button>
          </div>
        );
      })}
      <div className="flex items-center gap-1 self-center text-[11px] text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        max 5 arquivos, ate 20MB cada
      </div>
    </div>
  );
}
