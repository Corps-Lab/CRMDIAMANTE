import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type RawItem = Record<string, unknown>;

function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthUserId(admin: ReturnType<typeof getServiceClient>, req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const userRes = await admin.auth.getUser(token);
  return userRes.data.user?.id || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const admin = getServiceClient();
    const userId = await getAuthUserId(admin, request);
    if (!userId) return jsonResponse({ error: "Não autenticado." }, 401);

    const body = await request.json();
    const q = String(body?.q || "").trim();
    const contractNumber = String(body?.contract_number || "").trim();

    if (!q || !contractNumber) {
      return jsonResponse({ error: "q e contract_number são obrigatórios." }, 400);
    }

    const [{ data: agent }, { data: contract }] = await Promise.all([
      admin.from("agents").select("user_id,is_active").eq("user_id", userId).maybeSingle(),
      admin.from("contracts").select("user_id").eq("contract_number", contractNumber).maybeSingle(),
    ]);

    const isAgent = !!agent?.is_active;
    const ownsContract = !!contract && contract.user_id === userId;

    if (!isAgent && !ownsContract) {
      return jsonResponse({ error: "Sem permissão para este contrato." }, 403);
    }

    const result = await admin.rpc("global_search_contract", {
      p_q: q,
      p_contract_number: contractNumber,
    });

    if (result.error) {
      return jsonResponse({ error: result.error.message }, 500);
    }

    const raw = (result.data || {}) as Record<string, RawItem[]>;

    const groups = {
      news: (raw.news || []).map((item) => ({
        type: "news",
        id: String(item.id || ""),
        title: String(item.title || ""),
        snippet: String(item.category || ""),
        link_target: "/novidades",
      })),
      documents: (raw.documents || []).map((item) => ({
        type: "documents",
        id: String(item.id || ""),
        title: String(item.title || ""),
        snippet: String(item.type || ""),
        link_target: "/informacoes",
      })),
      faq: (raw.faq || []).map((item) => ({
        type: "faq",
        id: String(item.id || ""),
        title: String(item.question || ""),
        snippet: String(item.category || ""),
        link_target: "/atendimento",
      })),
      tickets: (raw.tickets || []).map((item) => ({
        type: "tickets",
        id: String(item.id || ""),
        title: String(item.subject || item.protocol || ""),
        snippet: String(item.status || ""),
        link_target: "/atendimento",
      })),
      bills: (raw.bills || []).map((item) => ({
        type: "bills",
        id: String(item.id || ""),
        title: `Boleto ${String(item.due_date || "")}`,
        snippet: String(item.status || ""),
        link_target: "/financeiro",
      })),
      messages: (raw.messages || []).map((item) => ({
        type: "messages",
        id: String(item.id || ""),
        title: "Mensagem",
        snippet: String(item.body_text || ""),
        link_target: "/atendimento",
      })),
    };

    return jsonResponse({
      contract_number: contractNumber,
      query: q,
      groups,
      total:
        groups.news.length +
        groups.documents.length +
        groups.faq.length +
        groups.tickets.length +
        groups.bills.length +
        groups.messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
