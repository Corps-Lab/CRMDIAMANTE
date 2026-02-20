import { supabase } from "@/integrations/supabase/client";

type SendAssistenciaPayload = {
  ticketId: string;
  phone: string;
  targetName?: string | null;
  status?: string | null;
  description?: string | null;
};

type SendCobrancaPayload = {
  transactionId: string;
  phone: string;
  targetName?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  description?: string | null;
};

type WhatsAppInvokeResult = {
  phone: string;
  simulated: boolean;
  providerMessageId: string | null;
  fallbackUrl: string;
};

function normalizePhone(raw: string | null | undefined) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12) return digits;
  return null;
}

async function invokeWhatsApp(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("whatsapp-gateway", {
    body,
  });

  if (error) {
    throw new Error(error.message || "Falha ao acionar integração de WhatsApp.");
  }

  const payload = (data || {}) as {
    ok?: boolean;
    error?: string;
    data?: WhatsAppInvokeResult;
  };

  if (!payload.ok) {
    throw new Error(payload.error || "Falha ao enviar mensagem no WhatsApp.");
  }

  return payload.data as WhatsAppInvokeResult;
}

export function normalizePhoneForWhatsApp(raw: string | null | undefined) {
  return normalizePhone(raw);
}

export async function sendAssistenciaWhatsApp(payload: SendAssistenciaPayload) {
  const phone = normalizePhone(payload.phone);
  if (!phone) {
    throw new Error("Contato invalido para WhatsApp. Informe com DDD.");
  }

  return invokeWhatsApp({
    action: "send_assistencia",
    ticketId: payload.ticketId,
    phone,
    targetName: payload.targetName || null,
    status: payload.status || null,
    description: payload.description || null,
  });
}

export async function sendCobrancaWhatsApp(payload: SendCobrancaPayload) {
  const phone = normalizePhone(payload.phone);
  if (!phone) {
    throw new Error("Telefone invalido para cobranca via WhatsApp.");
  }

  return invokeWhatsApp({
    action: "send_cobranca",
    transactionId: payload.transactionId,
    phone,
    targetName: payload.targetName || null,
    amount: payload.amount ?? null,
    dueDate: payload.dueDate || null,
    description: payload.description || null,
  });
}
