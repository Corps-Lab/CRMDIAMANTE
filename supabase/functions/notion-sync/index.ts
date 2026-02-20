import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_VERSION = "2022-06-28";

type NotionQueryResponse = {
  results?: Array<Record<string, unknown>>;
};

type NormalizedRecorrencia = "mensal" | "trimestral" | "semestral" | "anual";

type NotionClientRecord = {
  notionPageId: string;
  razaoSocial: string;
  cnpj: string;
  cpf: string | null;
  endereco: string;
  valorPago: number;
  recorrencia: NormalizedRecorrencia;
  responsavel: string;
  contatoInterno: string;
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toDigits(value: string | null) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

function parseCurrencyLike(value: string | null) {
  if (!value) return 0;
  const cleaned = value.trim();
  if (!cleaned) return 0;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRecorrencia(value: string | null): NormalizedRecorrencia {
  if (!value) return "mensal";
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("tri")) return "trimestral";
  if (normalized.includes("semi")) return "semestral";
  if (normalized.includes("anu")) return "anual";
  return "mensal";
}

function propertyText(property: unknown): string | null {
  if (!property || typeof property !== "object") return null;
  const typed = property as Record<string, unknown>;
  const type = typed.type;

  if (type === "title" && Array.isArray(typed.title)) {
    const value = typed.title
      .map((item) => (item as Record<string, unknown>)?.plain_text)
      .filter((entry) => typeof entry === "string")
      .join("")
      .trim();
    return value || null;
  }

  if (type === "rich_text" && Array.isArray(typed.rich_text)) {
    const value = typed.rich_text
      .map((item) => (item as Record<string, unknown>)?.plain_text)
      .filter((entry) => typeof entry === "string")
      .join("")
      .trim();
    return value || null;
  }

  if (type === "select") {
    const select = typed.select as Record<string, unknown> | null;
    const value = typeof select?.name === "string" ? select.name.trim() : "";
    return value || null;
  }

  if (type === "multi_select" && Array.isArray(typed.multi_select)) {
    const value = typed.multi_select
      .map((item) => (item as Record<string, unknown>)?.name)
      .filter((entry) => typeof entry === "string")
      .join(", ")
      .trim();
    return value || null;
  }

  if (type === "email") {
    const value = typeof typed.email === "string" ? typed.email.trim() : "";
    return value || null;
  }

  if (type === "phone_number") {
    const value = typeof typed.phone_number === "string" ? typed.phone_number.trim() : "";
    return value || null;
  }

  if (type === "url") {
    const value = typeof typed.url === "string" ? typed.url.trim() : "";
    return value || null;
  }

  if (type === "number") {
    const value = typed.number;
    return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
  }

  if (type === "formula" && typed.formula && typeof typed.formula === "object") {
    return propertyText(typed.formula);
  }

  return null;
}

function propertyNumber(property: unknown): number {
  if (!property || typeof property !== "object") return 0;
  const typed = property as Record<string, unknown>;
  if (typed.type === "number" && typeof typed.number === "number" && Number.isFinite(typed.number)) {
    return typed.number;
  }
  return parseCurrencyLike(propertyText(property));
}

function pickProperty(
  properties: Record<string, unknown>,
  names: string[],
  extractor: (property: unknown) => string | null,
) {
  const entries = Object.entries(properties);

  for (const name of names) {
    const direct = properties[name];
    const directValue = extractor(direct);
    if (directValue) return directValue;

    const foundEntry = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (!foundEntry) continue;
    const value = extractor(foundEntry[1]);
    if (value) return value;
  }

  return null;
}

function pickNumberProperty(properties: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(properties);

  for (const name of names) {
    const direct = properties[name];
    const directValue = propertyNumber(direct);
    if (directValue > 0) return directValue;

    const foundEntry = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (!foundEntry) continue;
    const value = propertyNumber(foundEntry[1]);
    if (value > 0) return value;
  }

  return 0;
}

function mapNotionClient(page: Record<string, unknown>): NotionClientRecord | null {
  const properties = (page.properties as Record<string, unknown>) || {};
  const razaoSocial =
    pickProperty(properties, ["razaoSocial", "Razao Social", "RazaoSocial", "Nome", "Cliente"], propertyText) || "";
  const cnpj = toDigits(
    pickProperty(properties, ["cnpj", "CNPJ", "Documento", "documento"], propertyText),
  );
  const cpf = toDigits(
    pickProperty(properties, ["cpf", "CPF", "Documento CPF"], propertyText),
  );

  if (!razaoSocial || (!cnpj && !cpf)) return null;

  const endereco =
    pickProperty(properties, ["endereco", "Endereco", "Endereço"], propertyText) || "";
  const recorrencia = normalizeRecorrencia(
    pickProperty(properties, ["recorrencia", "Recorrencia", "Periodicidade"], propertyText),
  );
  const responsavel =
    pickProperty(properties, ["responsavel", "Responsavel", "Contato"], propertyText) || "";
  const contatoInterno =
    pickProperty(properties, ["contatoInterno", "Contato Interno", "Email", "Telefone"], propertyText) || "";
  const valorPago = pickNumberProperty(properties, ["valorPago", "Valor Pago", "Valor", "Mensalidade"]);
  const notionPageId = typeof page.id === "string" ? page.id : crypto.randomUUID();

  return {
    notionPageId,
    razaoSocial,
    cnpj,
    cpf: cpf || null,
    endereco,
    valorPago,
    recorrencia,
    responsavel,
    contatoInterno,
  };
}

async function queryClientsFromNotion(
  notionToken: string,
  databaseId: string,
  pageSize: number,
) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: pageSize }),
  });

  const payloadText = await response.text();
  const payload = payloadText ? (JSON.parse(payloadText) as NotionQueryResponse & { message?: string }) : {};

  if (!response.ok) {
    throw new Error(payload?.message || "Falha ao consultar banco no Notion.");
  }

  const pages = Array.isArray(payload.results) ? payload.results : [];
  const clients = pages.map(mapNotionClient).filter(Boolean) as NotionClientRecord[];
  return { pages, clients };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, { ok: false, error: "Nao autorizado." });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(401, { ok: false, error: "Sessao invalida." });
    }

    const notionToken = Deno.env.get("NOTION_TOKEN") ?? "";
    const notionDatabaseId = Deno.env.get("NOTION_DATABASE_CLIENTES_ID") ?? "";
    const body = (await req.json().catch(() => ({}))) as { action?: string; limit?: number };
    const action = body.action ?? "status";
    const limit = Math.min(100, Math.max(1, Number(body.limit ?? 20)));

    if (action === "status") {
      if (!notionToken || !notionDatabaseId) {
        return jsonResponse(200, {
          ok: true,
          data: {
            configured: false,
            message: "Defina NOTION_TOKEN e NOTION_DATABASE_CLIENTES_ID nos secrets da function.",
          },
        });
      }

      const { pages } = await queryClientsFromNotion(notionToken, notionDatabaseId, 1);
      return jsonResponse(200, {
        ok: true,
        data: {
          configured: true,
          totalAmostra: pages.length,
          message: "Conexao com Notion validada com sucesso.",
        },
      });
    }

    if (action === "preview_clients") {
      if (!notionToken || !notionDatabaseId) {
        return jsonResponse(400, {
          ok: false,
          error: "Notion nao configurado. Defina NOTION_TOKEN e NOTION_DATABASE_CLIENTES_ID.",
        });
      }

      const { pages, clients } = await queryClientsFromNotion(notionToken, notionDatabaseId, limit);
      return jsonResponse(200, {
        ok: true,
        data: {
          clients,
          fetched: pages.length,
          skipped: Math.max(0, pages.length - clients.length),
        },
      });
    }

    return jsonResponse(400, { ok: false, error: "Acao invalida." });
  } catch (error) {
    console.error("notion-sync error", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return jsonResponse(500, { ok: false, error: message });
  }
});
