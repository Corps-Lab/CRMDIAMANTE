import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type LoginAttemptsRow = {
  cpf: string;
  attempts: number;
  locked_until: string | null;
};

type AnyRow = Record<string, unknown>;

function normalizeCpf(input: string): string {
  return (input || "").replace(/\D/g, "");
}

function normalizePass6(input: string): string {
  return (input || "").replace(/\D/g, "").slice(0, 6);
}

function digitsOnly(input: string): string {
  return (input || "").replace(/\D/g, "");
}

function isObject(value: unknown): value is AnyRow {
  return !!value && typeof value === "object";
}

function readString(row: AnyRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isMissingDbObjectError(error: unknown): boolean {
  if (!isObject(error)) return false;
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : "";
  return code === "42P01" || code === "42703" || code === "PGRST205" || /does not exist/i.test(message);
}

function toContractRow(row: AnyRow, userId: string, cpf: string): AnyRow {
  const contractNumber =
    readString(row, ["contract_number", "numero_contrato", "contract_id", "id"]) || `CTR-${cpf.slice(-6)}`;
  const developmentName =
    readString(row, ["development_name", "empreendimento", "development", "obra_nome"]) || "Empreendimento";
  const unitLabel = readString(row, ["unit_label", "unidade", "unit", "lote"]) || "Unidade";
  const developmentId =
    readString(row, ["development_id", "empreendimento_id"]) || developmentName.toLowerCase().replace(/\s+/g, "-");
  const unitId = readString(row, ["unit_id", "unidade_id"]) || unitLabel.toLowerCase().replace(/\s+/g, "-");
  const createdAt = readString(row, ["created_at"]) || new Date().toISOString();

  return {
    contract_number: contractNumber,
    user_id: userId,
    development_id: developmentId,
    development_name: developmentName,
    unit_id: unitId,
    unit_label: unitLabel,
    created_at: createdAt,
  };
}

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string, factor: number) => {
    let sum = 0;
    for (const c of base) {
      sum += Number(c) * factor;
      factor -= 1;
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
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

function getAnonClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY não configurados.");
  }
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function incrementFailure(
  admin: ReturnType<typeof getServiceClient>,
  cpf: string,
  previousAttempts: number,
) {
  const nextAttempts = previousAttempts + 1;
  const lock = nextAttempts >= 5 ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;

  const { error } = await admin.from("login_attempts").upsert({
    cpf,
    attempts: nextAttempts,
    last_failed_at: new Date().toISOString(),
    locked_until: lock,
  });

  if (error && !isMissingDbObjectError(error)) {
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();
    const cpf = normalizeCpf(String(body?.cpf || ""));
    const pass6 = normalizePass6(String(body?.pass6 || ""));

    if (!isValidCpf(cpf) || !/^\d{6}$/.test(pass6)) {
      return jsonResponse({ error: "Credenciais inválidas." }, 400);
    }

    const admin = getServiceClient();

    const attemptsRes = await admin
      .from("login_attempts")
      .select("cpf,attempts,locked_until")
      .eq("cpf", cpf)
      .maybeSingle();

    const attempts =
      attemptsRes.error && isMissingDbObjectError(attemptsRes.error)
        ? null
        : ((attemptsRes.data || null) as LoginAttemptsRow | null);
    const lockExpired =
      !!attempts?.locked_until && new Date(attempts.locked_until).getTime() <= Date.now();
    const baselineAttempts = lockExpired ? 0 : attempts?.attempts || 0;

    if (attempts?.locked_until && new Date(attempts.locked_until).getTime() > Date.now()) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil((new Date(attempts.locked_until).getTime() - Date.now()) / 1000),
      );
      return jsonResponse(
        {
          error: "Conta temporariamente bloqueada.",
          locked_until: attempts.locked_until,
          remaining_seconds: remainingSeconds,
        },
        423,
      );
    }

    const profileRes = await admin
      .from("profiles")
      .select("*")
      .eq("cpf", cpf)
      .maybeSingle();

    if (profileRes.error && !isMissingDbObjectError(profileRes.error)) {
      throw profileRes.error;
    }

    const profileRow = (profileRes.data || null) as AnyRow | null;

    if (!profileRow) {
      await incrementFailure(admin, cpf, baselineAttempts);
      return jsonResponse({ error: "CPF ou senha invalidos." }, 401);
    }

    const portalAccessEnabled =
      typeof profileRow.portal_access_enabled === "boolean" ? profileRow.portal_access_enabled : true;

    if (!portalAccessEnabled) {
      return jsonResponse(
        { error: "Acesso do portal desativado para este cliente." },
        403,
      );
    }

    const derivedPhone =
      readString(profileRow, ["phone_e164", "telefone", "phone", "celular"]) ||
      readString(profileRow, ["phone_last6"]) ||
      "";
    const expectedPass6 = readString(profileRow, ["phone_last6"]) || digitsOnly(derivedPhone).slice(-6);

    if (!expectedPass6 || expectedPass6 !== pass6) {
      await incrementFailure(admin, cpf, baselineAttempts);
      return jsonResponse({ error: "CPF ou senha invalidos." }, 401);
    }

    const userId = readString(profileRow, ["user_id"]);
    if (!userId) {
      return jsonResponse({ error: "Perfil sem user_id vinculado. Atualize o cadastro no Supabase." }, 500);
    }

    const email = `${cpf}@portal.local`;
    const anon = getAnonClient();
    const signInRes = await anon.auth.signInWithPassword({ email, password: pass6 });

    if (signInRes.error || !signInRes.data.session) {
      await incrementFailure(admin, cpf, baselineAttempts);
      return jsonResponse({ error: "CPF ou senha invalidos." }, 401);
    }

    const deleteAttempts = await admin.from("login_attempts").delete().eq("cpf", cpf);
    if (deleteAttempts.error && !isMissingDbObjectError(deleteAttempts.error)) {
      throw deleteAttempts.error;
    }

    const contractsRes = await admin
      .from("contracts")
      .select("*")
      .eq("user_id", userId);

    let contracts: AnyRow[] = [];
    if (!contractsRes.error && Array.isArray(contractsRes.data)) {
      contracts = contractsRes.data.map((row) => toContractRow((row || {}) as AnyRow, userId, cpf));
    }

    if (contracts.length === 0) {
      contracts = [
        {
          contract_number: `CTR-${cpf.slice(-6)}`,
          user_id: userId,
          development_id: "sem-empreendimento",
          development_name: "Empreendimento nao informado",
          unit_id: "sem-unidade",
          unit_label: "Unidade nao informada",
          created_at: new Date().toISOString(),
        },
      ];
    }

    const profile = {
      user_id: userId,
      cpf,
      full_name: readString(profileRow, ["full_name", "nome"]) || "Cliente",
      phone_e164: readString(profileRow, ["phone_e164", "telefone", "phone"]) || "",
      phone_last6: expectedPass6,
      client_external_id: readString(profileRow, ["client_external_id", "id"]),
      portal_access_enabled: portalAccessEnabled,
      email_contact: readString(profileRow, ["email_contact", "email"]),
      address_line: readString(profileRow, ["address_line", "endereco"]),
      created_at: readString(profileRow, ["created_at"]) || new Date().toISOString(),
    };

    return jsonResponse({
      session: {
        access_token: signInRes.data.session.access_token,
        refresh_token: signInRes.data.session.refresh_token,
        expires_in: signInRes.data.session.expires_in,
        token_type: signInRes.data.session.token_type,
      },
      profile,
      contracts,
      locked_until: null,
      remaining_seconds: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
