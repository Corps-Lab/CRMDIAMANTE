import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type SyncPayload = {
  profiles?: Array<Record<string, unknown>>;
  contracts?: Array<Record<string, unknown>>;
  news?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  financial_bills?: Array<Record<string, unknown>>;
  financial_statement?: Array<Record<string, unknown>>;
  construction_progress?: Array<Record<string, unknown>>;
  photo_galleries?: Array<Record<string, unknown>>;
  photo_gallery_items?: Array<Record<string, unknown>>;
};

type JsonRecord = Record<string, unknown>;

type ExistingProfile = {
  user_id: string;
  cpf: string;
  full_name: string;
  phone_e164: string;
  phone_last6: string;
  client_external_id: string | null;
  portal_access_enabled: boolean;
};

function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nao configurados.");
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

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function pickString(row: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asTrimmedString(row[key]);
    if (value) return value;
  }
  return null;
}

function normalizeDigits(value: string | null): string {
  return (value || "").replace(/\D/g, "");
}

function normalizeCpf(value: string | null): string | null {
  const digits = normalizeDigits(value);
  return /^\d{11}$/.test(digits) ? digits : null;
}

function normalizePass6(value: string | null): string | null {
  const digits = normalizeDigits(value);
  if (digits.length >= 6) {
    const last6 = digits.slice(-6);
    if (/^\d{6}$/.test(last6)) return last6;
  }
  return null;
}

function normalizePhoneE164(value: string | null, fallbackPass6: string | null): string | null {
  const digits = normalizeDigits(value);
  if (digits) {
    if (digits.startsWith("55")) return `+${digits}`;
    return `+55${digits}`;
  }
  if (!fallbackPass6) return null;
  return `+550000${fallbackPass6}`;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes", "y", "ativo", "active"].includes(normalized)) return true;
    if (["false", "0", "nao", "no", "n", "inativo", "inactive"].includes(normalized)) return false;
  }
  return null;
}

function resolvePortalEnabled(row: JsonRecord, existing?: ExistingProfile | null): boolean {
  const explicit =
    normalizeBoolean(row.portal_access_enabled) ??
    normalizeBoolean(row.is_active) ??
    normalizeBoolean(row.active);

  if (explicit !== null) return explicit;

  const status = pickString(row, ["status", "portal_status", "situacao", "situation"])?.toLowerCase();
  if (status) {
    if (status.includes("inativ") || status.includes("cancel") || status.includes("encerr")) {
      return false;
    }
    if (status.includes("ativ") || status.includes("active")) {
      return true;
    }
  }

  if (existing) return existing.portal_access_enabled;
  return true;
}

async function listAuthUserByEmail(
  admin: ReturnType<typeof getServiceClient>,
  email: string,
) {
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const usersRes = await admin.auth.admin.listUsers({ page, perPage });
    if (usersRes.error) throw usersRes.error;
    const users = usersRes.data.users || [];
    const found = users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

async function ensurePortalAuthUser(
  admin: ReturnType<typeof getServiceClient>,
  params: { cpf: string; pass6: string; userId?: string | null },
) {
  const email = `${params.cpf}@portal.local`;
  const userId = params.userId || null;

  if (userId) {
    const updateAuth = await admin.auth.admin.updateUserById(userId, {
      email,
      password: params.pass6,
      email_confirm: true,
    });
    if (!updateAuth.error) return { userId, created: false, credentialsSynced: true };

    const fallback = await admin.auth.admin.updateUserById(userId, {
      password: params.pass6,
    });
    if (fallback.error) throw fallback.error;
    return { userId, created: false, credentialsSynced: true };
  }

  const createAuth = await admin.auth.admin.createUser({
    email,
    password: params.pass6,
    email_confirm: true,
  });

  if (!createAuth.error && createAuth.data.user?.id) {
    return {
      userId: createAuth.data.user.id,
      created: true,
      credentialsSynced: true,
    };
  }

  const fallbackUser = await listAuthUserByEmail(admin, email);
  if (!fallbackUser?.id) {
    throw createAuth.error || new Error(`Falha ao criar usuario para CPF ${params.cpf}.`);
  }

  const syncAuth = await admin.auth.admin.updateUserById(fallbackUser.id, {
    password: params.pass6,
  });
  if (syncAuth.error) throw syncAuth.error;

  return {
    userId: fallbackUser.id,
    created: false,
    credentialsSynced: true,
  };
}

async function prepareProfilesForSync(
  admin: ReturnType<typeof getServiceClient>,
  profileRows: Array<Record<string, unknown>> | undefined,
) {
  if (!profileRows || profileRows.length === 0) {
    return {
      rows: [] as Array<Record<string, unknown>>,
      cpfToUserId: new Map<string, string>(),
      externalIdToUserId: new Map<string, string>(),
      createdAuthUsers: 0,
      syncedCredentials: 0,
      skipped: [] as string[],
    };
  }

  const normalizedCpfs = Array.from(
    new Set(
      profileRows
        .map((row) => normalizeCpf(pickString(row, ["cpf"])))
        .filter((cpf): cpf is string => !!cpf),
    ),
  );

  const existingMap = new Map<string, ExistingProfile>();
  if (normalizedCpfs.length > 0) {
    const existingRes = await admin
      .from("profiles")
      .select(
        "user_id,cpf,full_name,phone_e164,phone_last6,client_external_id,portal_access_enabled",
      )
      .in("cpf", normalizedCpfs);
    if (existingRes.error) throw new Error(`profiles lookup: ${existingRes.error.message}`);
    for (const row of (existingRes.data || []) as ExistingProfile[]) {
      existingMap.set(row.cpf, row);
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  const cpfToUserId = new Map<string, string>();
  const externalIdToUserId = new Map<string, string>();
  const skipped: string[] = [];
  let createdAuthUsers = 0;
  let syncedCredentials = 0;

  for (const rawRow of profileRows) {
    const row = rawRow as JsonRecord;
    const cpf = normalizeCpf(pickString(row, ["cpf"]));
    if (!cpf) {
      skipped.push("profile_sem_cpf_valido");
      continue;
    }

    const existing = existingMap.get(cpf) || null;
    const portalEnabled = resolvePortalEnabled(row, existing);
    const fullName =
      pickString(row, ["full_name", "nome", "name"]) ||
      existing?.full_name ||
      `Cliente ${cpf.slice(-4)}`;

    const incomingExternalId = pickString(row, [
      "client_external_id",
      "external_client_id",
      "crm_client_id",
    ]);
    const externalId = incomingExternalId || existing?.client_external_id || null;

    const incomingPass6 = normalizePass6(
      pickString(row, ["phone_last6", "pass6", "senha6"]),
    );
    const phoneFromRow = pickString(row, ["phone_e164", "telefone", "phone"]);
    const phoneE164 =
      normalizePhoneE164(phoneFromRow, incomingPass6) ||
      existing?.phone_e164 ||
      null;

    const finalPass6 =
      incomingPass6 ||
      normalizePass6(phoneE164) ||
      normalizePass6(existing?.phone_last6 || null);

    let userId = pickString(row, ["user_id"]) || existing?.user_id || null;

    if (!userId && portalEnabled) {
      if (!finalPass6) {
        skipped.push(`profile_${cpf}_sem_pass6`);
        continue;
      }
      const provisioned = await ensurePortalAuthUser(admin, {
        cpf,
        pass6: finalPass6,
      });
      userId = provisioned.userId;
      if (provisioned.created) createdAuthUsers += 1;
      if (provisioned.credentialsSynced) syncedCredentials += 1;
    } else if (userId && portalEnabled && finalPass6) {
      const provisioned = await ensurePortalAuthUser(admin, {
        cpf,
        pass6: finalPass6,
        userId,
      });
      userId = provisioned.userId;
      if (provisioned.created) createdAuthUsers += 1;
      if (provisioned.credentialsSynced) syncedCredentials += 1;
    }

    if (!userId) {
      skipped.push(`profile_${cpf}_sem_user_id`);
      continue;
    }
    if (!finalPass6 || !phoneE164) {
      skipped.push(`profile_${cpf}_sem_telefone_valido`);
      continue;
    }

    rows.push({
      user_id: userId,
      cpf,
      full_name: fullName,
      phone_e164: phoneE164,
      phone_last6: finalPass6,
      client_external_id: externalId,
      portal_access_enabled: portalEnabled,
    });

    cpfToUserId.set(cpf, userId);
    if (externalId) externalIdToUserId.set(externalId, userId);
  }

  return {
    rows,
    cpfToUserId,
    externalIdToUserId,
    createdAuthUsers,
    syncedCredentials,
    skipped,
  };
}

function enrichContractsForSync(
  rows: Array<Record<string, unknown>> | undefined,
  maps: { cpfToUserId: Map<string, string>; externalIdToUserId: Map<string, string> },
) {
  if (!rows || rows.length === 0) {
    return { upsertRows: [] as Array<Record<string, unknown>>, skipped: [] as string[] };
  }

  const upsertRows: Array<Record<string, unknown>> = [];
  const skipped: string[] = [];

  for (const rawRow of rows) {
    const row = { ...rawRow } as JsonRecord;
    let userId = pickString(row, ["user_id"]);

    if (!userId) {
      const cpf = normalizeCpf(pickString(row, ["cpf", "client_cpf", "owner_cpf"]));
      if (cpf) userId = maps.cpfToUserId.get(cpf) || null;
    }

    if (!userId) {
      const externalId = pickString(row, [
        "client_external_id",
        "external_client_id",
        "crm_client_id",
      ]);
      if (externalId) userId = maps.externalIdToUserId.get(externalId) || null;
    }

    if (!userId) {
      skipped.push(`contract_${pickString(row, ["contract_number"]) || "sem_numero"}_sem_user_id`);
      continue;
    }

    upsertRows.push({ ...row, user_id: userId });
  }

  return { upsertRows, skipped };
}

async function upsertIfPresent(
  admin: ReturnType<typeof getServiceClient>,
  table: string,
  rows: Array<Record<string, unknown>> | undefined,
  onConflict?: string,
) {
  if (!rows || rows.length === 0) return 0;
  const query = admin.from(table).upsert(rows, onConflict ? { onConflict } : undefined);
  const { error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return rows.length;
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
    if (!userId) return jsonResponse({ error: "Nao autenticado." }, 401);

    const agentRes = await admin
      .from("agents")
      .select("user_id,is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (!agentRes.data?.is_active) {
      return jsonResponse({ error: "Apenas agentes podem sincronizar dados." }, 403);
    }

    const payload = (await request.json()) as SyncPayload;

    const preparedProfiles = await prepareProfilesForSync(admin, payload.profiles);
    const preparedContracts = enrichContractsForSync(payload.contracts, {
      cpfToUserId: preparedProfiles.cpfToUserId,
      externalIdToUserId: preparedProfiles.externalIdToUserId,
    });

    const result = {
      profiles: await upsertIfPresent(admin, "profiles", preparedProfiles.rows, "user_id"),
      contracts: await upsertIfPresent(admin, "contracts", preparedContracts.upsertRows, "contract_number"),
      news: await upsertIfPresent(admin, "news", payload.news, "id"),
      documents: await upsertIfPresent(admin, "documents", payload.documents, "id"),
      financial_bills: await upsertIfPresent(admin, "financial_bills", payload.financial_bills, "id"),
      financial_statement: await upsertIfPresent(admin, "financial_statement", payload.financial_statement, "id"),
      construction_progress: await upsertIfPresent(
        admin,
        "construction_progress",
        payload.construction_progress,
        "contract_number",
      ),
      photo_galleries: await upsertIfPresent(
        admin,
        "photo_galleries",
        payload.photo_galleries,
        "contract_number,month_ref",
      ),
      photo_gallery_items: await upsertIfPresent(
        admin,
        "photo_gallery_items",
        payload.photo_gallery_items,
        "id",
      ),
      auth_users_created: preparedProfiles.createdAuthUsers,
      auth_credentials_synced: preparedProfiles.syncedCredentials,
      skipped_profiles: preparedProfiles.skipped,
      skipped_contracts: preparedContracts.skipped,
    };

    return jsonResponse({
      ok: true,
      message: "Sync mock executada com sucesso.",
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
