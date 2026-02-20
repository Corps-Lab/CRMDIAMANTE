import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendAction = "send_assistencia" | "send_cobranca";

interface SendRequestPayload {
  action: SendAction;
  phone: string;
  message?: string;
  targetName?: string | null;
  ticketId?: string | null;
  transactionId?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  description?: string | null;
  status?: string | null;
}

interface OutboundResult {
  sent: boolean;
  simulated: boolean;
  providerMessageId: string | null;
  fallbackUrl: string;
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function normalizePhone(raw: string | null | undefined, defaultCountry = "55") {
  const digits = toDigits(raw);
  if (!digits) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10 || digits.length === 11) return `${defaultCountry}${digits}`;
  if (digits.length >= 12) return digits;
  return null;
}

function parseCurrency(value: number | null | undefined) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(num) ? num : 0);
}

function assistenciaDefaultMessage(payload: SendRequestPayload) {
  const nome = payload.targetName?.trim() || "cliente";
  const status = payload.status ? `Status: ${payload.status}. ` : "";
  const descricao = payload.description ? `Detalhe: ${payload.description}. ` : "";
  return `Oi ${nome}, aqui e da Assistencia Tecnica da Diamante. ${status}${descricao}Em caso de duvidas, responda esta mensagem.`;
}

function cobrancaDefaultMessage(payload: SendRequestPayload) {
  const nome = payload.targetName?.trim() || "cliente";
  const valor = parseCurrency(payload.amount);
  const vencimento = payload.dueDate || "sem data";
  const descricao = payload.description ? ` Referencia: ${payload.description}.` : "";
  return `Oi ${nome}, identificamos pendencia financeira no valor de ${valor} (vencimento ${vencimento}).${descricao} Podemos te ajudar com a regularizacao por aqui.`;
}

async function sendMetaCloudMessage(
  phone: string,
  message: string,
  token: string,
  phoneNumberId: string,
): Promise<{ id: string | null }> {
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = payload?.error?.message || "Falha ao enviar WhatsApp pelo provedor.";
    throw new Error(msg);
  }

  const providerId =
    payload?.messages?.[0]?.id || payload?.message_id || null;
  return { id: providerId };
}

function extractWebhookMessages(payload: Record<string, unknown>) {
  const events: Array<{
    phone: string;
    name: string;
    messageText: string;
    referral: Record<string, unknown> | null;
    raw: Record<string, unknown>;
  }> = [];

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray((entry as Record<string, unknown>).changes)
      ? ((entry as Record<string, unknown>).changes as Array<Record<string, unknown>>)
      : [];

    for (const change of changes) {
      const value = ((change as Record<string, unknown>).value ||
        {}) as Record<string, unknown>;
      const contacts = Array.isArray(value.contacts)
        ? (value.contacts as Array<Record<string, unknown>>)
        : [];
      const messages = Array.isArray(value.messages)
        ? (value.messages as Array<Record<string, unknown>>)
        : [];

      for (const message of messages) {
        const from = String(message.from || "");
        if (!from) continue;
        const contact = contacts.find((c) => String(c.wa_id || "") === from);
        const profile = (contact?.profile || {}) as Record<string, unknown>;
        const name = String(profile.name || "Lead WhatsApp").trim();
        const textBody = String(
          ((message.text || {}) as Record<string, unknown>).body || "",
        ).trim();
        const buttonText = String(
          ((message.button || {}) as Record<string, unknown>).text || "",
        ).trim();
        const interactiveTitle = String(
          (((message.interactive || {}) as Record<string, unknown>).button_reply ||
            {})["title"] || "",
        ).trim();
        const referral = (message.referral || null) as Record<string, unknown> | null;
        const messageText = textBody || buttonText || interactiveTitle || "";

        events.push({
          phone: from,
          name,
          messageText,
          referral,
          raw: message,
        });
      }
    }
  }

  return events;
}

function buildFallbackUrl(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const metaToken = Deno.env.get("WHATSAPP_TOKEN") ?? "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
  const countryCode = Deno.env.get("WHATSAPP_DEFAULT_COUNTRY") ?? "55";

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get("Authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : "";

    // Meta webhook verification
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
        return new Response(challenge || "ok", { status: 200 });
      }
      return new Response("forbidden", { status: 403 });
    }

    // Internal send action from CRM
    if (bearerToken) {
      const body = (await req.json()) as SendRequestPayload;
      if (!body?.action || !body?.phone) {
        return jsonResponse(400, { ok: false, error: "Dados obrigatorios ausentes." });
      }

      const {
        data: { user },
        error: userError,
      } = await admin.auth.getUser(bearerToken);
      if (userError || !user) {
        return jsonResponse(401, { ok: false, error: "Sessao invalida." });
      }

      const normalizedPhone = normalizePhone(body.phone, countryCode);
      if (!normalizedPhone) {
        return jsonResponse(400, { ok: false, error: "Telefone invalido para WhatsApp." });
      }

      const message =
        body.message?.trim() ||
        (body.action === "send_assistencia"
          ? assistenciaDefaultMessage(body)
          : cobrancaDefaultMessage(body));

      let outbound: OutboundResult = {
        sent: false,
        simulated: true,
        providerMessageId: null,
        fallbackUrl: buildFallbackUrl(normalizedPhone, message),
      };
      let sendError: string | null = null;

      try {
        if (metaToken && phoneNumberId) {
          const result = await sendMetaCloudMessage(
            normalizedPhone,
            message,
            metaToken,
            phoneNumberId,
          );
          outbound = {
            sent: true,
            simulated: false,
            providerMessageId: result.id,
            fallbackUrl: buildFallbackUrl(normalizedPhone, message),
          };
        } else {
          outbound = {
            sent: true,
            simulated: true,
            providerMessageId: "simulado",
            fallbackUrl: buildFallbackUrl(normalizedPhone, message),
          };
        }
      } catch (error) {
        sendError = error instanceof Error ? error.message : "Erro ao enviar WhatsApp.";
      }

      const status = sendError ? "failed" : "sent";
      const channel = body.action === "send_assistencia" ? "assistencia" : "cobranca";
      const externalRefType = body.action === "send_assistencia" ? "ticket" : "transaction";
      const externalRefId =
        body.action === "send_assistencia" ? body.ticketId || null : body.transactionId || null;

      await admin.from("whatsapp_messages").insert({
        direction: "outbound",
        channel,
        status,
        phone: normalizedPhone,
        target_name: body.targetName || null,
        message,
        provider: "meta_cloud",
        provider_message_id: outbound.providerMessageId,
        external_ref_type: externalRefType,
        external_ref_id: externalRefId,
        payload: body,
        error: sendError,
        created_by: user.id,
      });

      if (sendError) {
        return jsonResponse(500, {
          ok: false,
          error: sendError,
          data: { fallbackUrl: outbound.fallbackUrl },
        });
      }

      return jsonResponse(200, {
        ok: true,
        data: {
          phone: normalizedPhone,
          simulated: outbound.simulated,
          providerMessageId: outbound.providerMessageId,
          fallbackUrl: outbound.fallbackUrl,
        },
      });
    }

    // Inbound webhook from Meta WhatsApp Cloud
    const webhookPayload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const events = extractWebhookMessages(webhookPayload);
    let leadsCreated = 0;

    for (const event of events) {
      const normalizedPhone = normalizePhone(event.phone, countryCode) || event.phone;
      const referral = event.referral;
      const fromAds = Boolean(referral && Object.keys(referral).length > 0);
      const sourceType = String((referral?.source_type as string) || "whatsapp");
      const sourceId = String((referral?.source_id as string) || "");
      const adHeadline = String((referral?.headline as string) || "");
      const adBody = String((referral?.body as string) || "");

      await admin.from("whatsapp_messages").insert({
        direction: "inbound",
        channel: fromAds ? "lead" : "outro",
        status: "received",
        phone: normalizedPhone,
        target_name: event.name,
        message: event.messageText || "",
        provider: "meta_cloud",
        payload: {
          referral,
          raw: event.raw,
        },
      });

      if (!fromAds) continue;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingLeads } = await admin
        .from("leads")
        .select("id")
        .eq("contato", normalizedPhone)
        .gte("created_at", thirtyDaysAgo)
        .limit(1);

      if ((existingLeads || []).length > 0) continue;

      const obsParts = [
        event.messageText ? `Mensagem inicial: ${event.messageText}` : null,
        sourceId ? `Source ID: ${sourceId}` : null,
        adHeadline ? `Headline anuncio: ${adHeadline}` : null,
        adBody ? `Texto anuncio: ${adBody}` : null,
      ].filter(Boolean);

      const { error: insertLeadError } = await admin.from("leads").insert({
        nome_cliente: event.name || `Lead ${normalizedPhone}`,
        contato: normalizedPhone,
        origem: `WhatsApp Ads (${sourceType})`,
        etapa: "lead",
        valor: 0,
        observacoes: obsParts.join(" | "),
      });

      if (!insertLeadError) {
        leadsCreated += 1;
      }
    }

    return jsonResponse(200, {
      ok: true,
      data: {
        events: events.length,
        leadsCreated,
      },
    });
  } catch (error) {
    console.error("whatsapp-gateway error", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return jsonResponse(500, { ok: false, error: message });
  }
});
