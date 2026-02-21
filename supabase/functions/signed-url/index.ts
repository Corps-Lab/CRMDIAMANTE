import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const ALLOWED_BUCKETS = new Set(["documents", "bills", "gallery", "tickets", "chat"]);

function contractFromPath(path: string): string {
  return String(path || "").split("/").filter(Boolean)[0] || "";
}

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
    const bucket = String(body?.bucket || "").trim();
    const path = String(body?.path || "").trim();
    const expiresInRaw = Number(body?.expiresIn ?? 90);
    const expiresIn = Number.isFinite(expiresInRaw)
      ? Math.max(30, Math.min(300, Math.round(expiresInRaw)))
      : 90;

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return jsonResponse({ error: "Bucket não permitido." }, 400);
    }
    if (!path) {
      return jsonResponse({ error: "path é obrigatório." }, 400);
    }

    const [{ data: agent }, { data: contractOwner }] = await Promise.all([
      admin.from("agents").select("user_id,is_active").eq("user_id", userId).maybeSingle(),
      admin
        .from("contracts")
        .select("user_id")
        .eq("contract_number", contractFromPath(path))
        .maybeSingle(),
    ]);

    const isAgent = !!agent?.is_active;
    const ownsContract = !!contractOwner && contractOwner.user_id === userId;

    if (!isAgent && !ownsContract) {
      return jsonResponse({ error: "Sem permissão para este arquivo." }, 403);
    }

    const signed = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (signed.error || !signed.data?.signedUrl) {
      return jsonResponse({ error: signed.error?.message || "Falha ao assinar URL." }, 500);
    }

    return jsonResponse({
      signedUrl: signed.data.signedUrl,
      expiresIn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
