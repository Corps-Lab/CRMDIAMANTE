import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

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
    if (!userId) {
      return jsonResponse({ error: "Não autenticado." }, 401);
    }

    const body = await request.json();
    const contractNumber = String(body?.contract_number || "").trim();
    if (!contractNumber) {
      return jsonResponse({ error: "contract_number é obrigatório." }, 400);
    }

    const [{ data: agent }, { data: contract }] = await Promise.all([
      admin.from("agents").select("user_id,is_active").eq("user_id", userId).maybeSingle(),
      admin.from("contracts").select("*").eq("contract_number", contractNumber).maybeSingle(),
    ]);

    if (!contract) {
      return jsonResponse({ error: "Contrato não encontrado." }, 404);
    }

    const isAgent = !!agent?.is_active;
    const ownsContract = contract.user_id === userId;

    if (!isAgent && !ownsContract) {
      return jsonResponse({ error: "Sem permissão para acessar este contrato." }, 403);
    }

    return jsonResponse({
      contract_number: contract.contract_number,
      development_name: contract.development_name,
      unit_label: contract.unit_label,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
