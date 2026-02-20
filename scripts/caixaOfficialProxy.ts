import type { IncomingMessage, ServerResponse } from "node:http";
import vm from "node:vm";
import type { Plugin } from "vite";

const CAIXA_BASE_URL = "https://www8.caixa.gov.br";
const CAIXA_APP_PATH = "/siopiinternet-web";
const INIT_PATH = `${CAIXA_APP_PATH}/simulaOperacaoInternet.do?method=inicializarCasoUso`;
const ENQUADRAR_PATH = `${CAIXA_APP_PATH}/simulaOperacaoInternet.do?method=enquadrarProdutos`;
const DWR_DIV_PATH = `${CAIXA_APP_PATH}/dwr/call/plaincall/SIOPIAjaxFrontController.callActionForwardMethodDiv.dwr`;
const DWR_LIST_PATH = `${CAIXA_APP_PATH}/dwr/call/plaincall/SIOPIAjaxFrontController.callActionForwardMethodLista.dwr`;
const DEFAULT_PAGE = "/siopiinternet-web/simulaOperacaoInternet.do?method=enquadrarProdutos";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type PessoaTipo = "F" | "J";
type SistemaAmortizacao = "price" | "sac";

interface OfficialSimulationRequest {
  valorImovel: number;
  recursosProprios: number;
  prazoMeses: number;
  rendaMensal: number;
  dataNascimento: string;
  uf: string;
  cidadeCodigo: string;
  pessoa: PessoaTipo;
  tipoImovel: string;
  grupoTipoFinanciamento: string;
  sistema: SistemaAmortizacao;
}

interface OfficialSimulationResponse {
  parcelaOficial: number;
  ultimaParcela: number | null;
  prazoMeses: number;
  valorFinanciamento: number;
  jurosNominalAnual: number | null;
  segurosMensais: number;
  taxaAdministracaoMensal: number;
  sistemaAmortizacaoCodigo: number | null;
  sistemaAmortizacaoNome: string | null;
  seguradora: string | null;
}

interface CaixaCityOption {
  codigo: string;
  nome: string;
}

const cityCache = new Map<string, CaixaCityOption[]>();

class CookieJar {
  private readonly values = new Map<string, string>();

  setFromHeaders(headers: Headers) {
    const dynamicHeaders = headers as Headers & { getSetCookie?: () => string[] };
    const cookies = dynamicHeaders.getSetCookie?.() ?? [];
    const fallbackCookie = headers.get("set-cookie");
    if (cookies.length === 0 && fallbackCookie) {
      cookies.push(fallbackCookie);
    }

    for (const cookie of cookies) {
      const firstPart = cookie.split(";")[0];
      const separator = firstPart.indexOf("=");
      if (separator < 1) continue;
      const name = firstPart.slice(0, separator).trim();
      const value = firstPart.slice(separator + 1).trim();
      if (!name) continue;
      this.values.set(name, value);
    }
  }

  asHeader() {
    if (this.values.size === 0) return "";
    return Array.from(this.values.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return (body ? JSON.parse(body) : {}) as T;
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return safe.toFixed(2).replace(".", ",");
}

function formatInteger(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `${safe}`;
}

function sanitizeDate(value: string) {
  if (!value) return "01/01/1985";
  const cleaned = value.trim();
  const isValid = /^\d{2}\/\d{2}\/\d{4}$/.test(cleaned);
  return isValid ? cleaned : "01/01/1985";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    let normalized = trimmed;
    const hasDot = trimmed.includes(".");
    const hasComma = trimmed.includes(",");
    if (hasDot && hasComma) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
      normalized = trimmed.replace(",", ".");
    } else {
      normalized = trimmed;
    }

    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractProduct(html: string) {
  const regex = /simuladorInternet\.simular\(\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']*)'/m;
  const match = html.match(regex);
  if (!match) return null;

  return {
    nuItemProduto: match[1],
    nuVersao: match[2],
    nome: match[3],
  };
}

function extractDwrArrayLiteral(responseText: string): string {
  const callbackMarker = 'dwr.engine.remote.handleCallback("';
  const start = responseText.indexOf(callbackMarker);
  if (start < 0) {
    throw new Error("Resposta oficial da CAIXA nao retornou callback esperado.");
  }

  const listStart = responseText.indexOf("[", start);
  if (listStart < 0) {
    throw new Error("Resposta oficial da CAIXA nao retornou dados de simulacao.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let listEnd = -1;

  for (let index = listStart; index < responseText.length; index += 1) {
    const char = responseText[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        listEnd = index;
        break;
      }
    }
  }

  if (listEnd < 0) {
    throw new Error("Nao foi possivel ler os dados oficiais da CAIXA.");
  }

  return responseText.slice(listStart, listEnd + 1);
}

function parseDwrArray(responseText: string): Record<string, unknown>[] {
  if (responseText.includes('handleCallback("') && responseText.includes(",null);")) {
    return [];
  }

  const arrayLiteral = extractDwrArrayLiteral(responseText);
  const parsed = vm.runInNewContext(arrayLiteral, { Date });
  return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
}

async function caixaRequest(
  path: string,
  jar: CookieJar,
  options?: { method?: string; body?: string; contentType?: string; referer?: string },
) {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "*/*",
  };

  const cookie = jar.asHeader();
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (options?.contentType) {
    headers["Content-Type"] = options.contentType;
  }
  if (options?.referer) {
    headers.Referer = options.referer;
  }
  headers.Origin = CAIXA_BASE_URL;

  const response = await fetch(`${CAIXA_BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body,
    redirect: "manual",
  });

  jar.setFromHeaders(response.headers);

  if (response.status >= 300 && response.status < 400) {
    const redirect = response.headers.get("location");
    if (redirect) {
      const redirectUrl = new URL(redirect, CAIXA_BASE_URL);
      if (redirectUrl.origin === CAIXA_BASE_URL) {
        return caixaRequest(`${redirectUrl.pathname}${redirectUrl.search}`, jar, {
          method: "GET",
          referer: options?.referer,
        });
      }
    }
  }

  const text = await response.text();
  return {
    status: response.status,
    text,
  };
}

function buildSimulationParameters(input: OfficialSimulationRequest, product: { nuItemProduto: string; nuVersao: string }) {
  const codSistemaAmortizacaoAlterado = input.sistema === "sac" ? "30" : "";
  const params = [
    `valorImovel=${formatMoney(input.valorImovel)}`,
    `rendaFamiliarBruta=${formatMoney(input.rendaMensal)}`,
    `tipoImovel=${input.tipoImovel}`,
    "imovelCidade=",
    "vaContaFgts=",
    "icLoteAlienado=",
    `grupoTipoFinanciamento=${input.grupoTipoFinanciamento}`,
    `dataNascimento=${sanitizeDate(input.dataNascimento)}`,
    `uf=${input.uf}`,
    `cidade=${input.cidadeCodigo}`,
    `nuItemProduto=${product.nuItemProduto}`,
    `nuVersao=${product.nuVersao}`,
    "valorReforma=",
    "codigoSeguradoraSelecionada=",
    "nomeSeguradora=",
    "dataBeneficioFGTS=",
    "beneficiadoFGTS=",
    "codContextoCredito=1",
    "complementouDadosSubsidio=true",
    `pessoa=${input.pessoa}`,
    "convenio=",
    "nuEmpresa=",
    "nuSeqPropostaInternet=",
    "permiteDetalhamento=S",
    `codSistemaAmortizacaoAlterado=${codSistemaAmortizacaoAlterado}`,
    "nuCpfCnpjInteressado=",
    "icFatorSocial=",
    "icPossuiRelacionamentoCAIXA=",
    "icServidorPublico=",
    "icContaSalarioCAIXA=",
    "icPortabilidadeCreditoImobiliario=",
    "vaNuApf=",
    "nuTelefoneCelular=",
    "icArmazenamentoDadoCliente=V",
    "vaIcTaxaCustomizada=",
    `prazo=${formatInteger(input.prazoMeses)}`,
    `recursosProprios=${formatMoney(input.recursosProprios)}`,
  ];

  return params.join(":");
}

function buildDwrPayload(batchId: number, simulationParams: string) {
  return [
    "callCount=1",
    `page=${encodeURIComponent(DEFAULT_PAGE)}`,
    "httpSessionId=",
    "scriptSessionId=",
    "instanceId=0",
    "c0-scriptName=SIOPIAjaxFrontController",
    "c0-methodName=callActionForwardMethodDiv",
    "c0-id=0",
    "c0-param0=string:/simulaOperacaoInternet",
    "c0-param1=string:simularOperacaoImobiliariaInternet",
    `c0-param2=string:${simulationParams}`,
    "c0-param3=string:resultadoSimulacao",
    `batchId=${batchId}`,
  ].join("\n");
}

function buildDwrCityPayload(batchId: number, uf: string) {
  return [
    "callCount=1",
    `page=${encodeURIComponent(DEFAULT_PAGE)}`,
    "httpSessionId=",
    "scriptSessionId=",
    "instanceId=0",
    "c0-scriptName=SIOPIAjaxFrontController",
    "c0-methodName=callActionForwardMethodLista",
    "c0-id=0",
    "c0-param0=string:/simulaOperacaoInternet",
    "c0-param1=string:listarCidades",
    `c0-param2=string:uf=${uf}`,
    `batchId=${batchId}`,
  ].join("\n");
}

async function simulateWithCaixaOfficial(input: OfficialSimulationRequest): Promise<OfficialSimulationResponse> {
  const jar = new CookieJar();
  const initial = await caixaRequest(INIT_PATH, jar, {
    method: "GET",
    referer: `${CAIXA_BASE_URL}${INIT_PATH}`,
  });
  if (initial.status >= 400 || initial.text.includes("ShieldSquare Block")) {
    throw new Error("A CAIXA bloqueou a consulta automatica neste momento.");
  }

  const formBody = new URLSearchParams({
    versao: "3.22.92.0.1 ",
    permitePlanilha: "S",
    codContextoCredito: "1",
    permiteDetalhamento: "S",
    pessoa: input.pessoa,
    tipoImovel: input.tipoImovel,
    grupoTipoFinanciamento: input.grupoTipoFinanciamento,
    valorImovel: formatMoney(input.valorImovel),
    uf: input.uf,
    cidade: input.cidadeCodigo,
    rendaFamiliarBruta: formatMoney(input.rendaMensal),
    dataNascimento: sanitizeDate(input.dataNascimento),
    icArmazenamentoDadoCliente: "V",
  });

  const enquadrar = await caixaRequest(ENQUADRAR_PATH, jar, {
    method: "POST",
    body: formBody.toString(),
    contentType: "application/x-www-form-urlencoded",
    referer: `${CAIXA_BASE_URL}${INIT_PATH}`,
  });
  if (enquadrar.status >= 400 || enquadrar.text.includes("ShieldSquare Block")) {
    throw new Error("Nao foi possivel carregar os produtos de financiamento na CAIXA.");
  }

  const product = extractProduct(enquadrar.text);
  if (!product) {
    throw new Error("A CAIXA nao retornou opcoes de produto para os dados informados.");
  }

  const simulationParams = buildSimulationParameters(input, product);
  const dwrPayload = buildDwrPayload(Math.floor(Date.now() % 10000), simulationParams);
  const dwr = await caixaRequest(DWR_DIV_PATH, jar, {
    method: "POST",
    body: dwrPayload,
    contentType: "text/plain",
    referer: `${CAIXA_BASE_URL}${ENQUADRAR_PATH}`,
  });

  if (dwr.status >= 400 || dwr.text.includes("ShieldSquare Block")) {
    throw new Error("A CAIXA bloqueou a simulacao automatica para esta consulta.");
  }

  const rows = parseDwrArray(dwr.text);
  if (rows.length === 0) {
    throw new Error(
      input.sistema === "sac"
        ? "A CAIXA nao retornou SAC automaticamente para este caso. Use o valor oficial manual."
        : "A CAIXA nao retornou uma parcela oficial para estes parametros.",
    );
  }

  const selected = rows[0];
  const parcela = parseNumber(selected.prestacao);
  if (!parcela || parcela <= 0) {
    throw new Error("A CAIXA nao retornou parcela valida.");
  }

  const ultimaParcela = parseNumber(selected.ultimaPrestacao);
  const valorFinanciamento = parseNumber(selected.valorFinanciamento) ?? 0;
  const jurosNominalAnual = parseNumber(selected.percentualTaxaJuros);
  const seguroMip = parseNumber(selected.seguroMip) ?? 0;
  const seguroDfi = parseNumber(selected.seguroDfi) ?? 0;
  const taxaAdministracao = parseNumber(selected.valorTaxaAdministracao) ?? parseNumber(selected.taxaAdministracao) ?? 0;
  const sistemaCodigo = parseNumber(selected.codigoSistemaAmortizacao);
  const sistemaNome = typeof selected.valorSistemaAmortizacao === "string" ? selected.valorSistemaAmortizacao : null;
  const seguradora = typeof selected.nomeSeguradora === "string" ? selected.nomeSeguradora : null;
  const prazoMeses = parseNumber(selected.prazo) ?? input.prazoMeses;

  return {
    parcelaOficial: parcela,
    ultimaParcela: ultimaParcela && ultimaParcela > 0 ? ultimaParcela : null,
    prazoMeses: Math.max(1, Math.round(prazoMeses)),
    valorFinanciamento,
    jurosNominalAnual,
    segurosMensais: seguroMip + seguroDfi,
    taxaAdministracaoMensal: taxaAdministracao,
    sistemaAmortizacaoCodigo: sistemaCodigo ? Math.round(sistemaCodigo) : null,
    sistemaAmortizacaoNome: sistemaNome,
    seguradora,
  };
}

async function fetchCitiesFromCaixa(uf: string): Promise<CaixaCityOption[]> {
  const cacheKey = uf.toUpperCase();
  const fromCache = cityCache.get(cacheKey);
  if (fromCache) return fromCache;

  const jar = new CookieJar();
  const initial = await caixaRequest(INIT_PATH, jar, {
    method: "GET",
    referer: `${CAIXA_BASE_URL}${INIT_PATH}`,
  });
  if (initial.status >= 400 || initial.text.includes("ShieldSquare Block")) {
    throw new Error("A CAIXA bloqueou a consulta de cidades neste momento.");
  }

  const payload = buildDwrCityPayload(Math.floor(Date.now() % 10000), cacheKey);
  const dwr = await caixaRequest(DWR_LIST_PATH, jar, {
    method: "POST",
    body: payload,
    contentType: "text/plain",
    referer: `${CAIXA_BASE_URL}${INIT_PATH}`,
  });
  if (dwr.status >= 400 || dwr.text.includes("ShieldSquare Block")) {
    throw new Error("Nao foi possivel carregar cidades da CAIXA.");
  }

  const rows = parseDwrArray(dwr.text);
  const normalized = rows
    .map((row) => ({
      codigo: `${row.codigo ?? ""}`.trim(),
      nome: `${row.nome ?? ""}`.trim(),
    }))
    .filter((row) => row.codigo && row.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  cityCache.set(cacheKey, normalized);
  return normalized;
}

function normalizeSimulationRequest(raw: Partial<OfficialSimulationRequest>): OfficialSimulationRequest {
  return {
    valorImovel: Number(raw.valorImovel) || 0,
    recursosProprios: Number(raw.recursosProprios) || 0,
    prazoMeses: Number(raw.prazoMeses) || 360,
    rendaMensal: Number(raw.rendaMensal) || 0,
    dataNascimento: sanitizeDate(raw.dataNascimento ?? ""),
    uf: (raw.uf || "SP").toUpperCase(),
    cidadeCodigo: `${raw.cidadeCodigo || "3550308"}`.trim(),
    pessoa: raw.pessoa === "J" ? "J" : "F",
    tipoImovel: `${raw.tipoImovel || "1"}`.trim(),
    grupoTipoFinanciamento: `${raw.grupoTipoFinanciamento || "1"}`.trim(),
    sistema: raw.sistema === "sac" ? "sac" : "price",
  };
}

export function createCaixaOfficialProxyPlugin(): Plugin {
  return {
    name: "caixa-official-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const basePath = req.url?.split("?")[0];
        if (basePath === "/api/caixa/cidades") {
          if (req.method !== "GET") {
            sendJson(res, 405, { error: "Metodo nao permitido." });
            return;
          }

          try {
            const parsedUrl = new URL(req.url || "/api/caixa/cidades", "http://localhost");
            const ufRaw = (parsedUrl.searchParams.get("uf") || "SP").toUpperCase().replace(/[^A-Z]/g, "");
            const uf = ufRaw.slice(0, 2);
            if (uf.length !== 2) {
              sendJson(res, 400, { error: "UF invalida." });
              return;
            }

            const cities = await fetchCitiesFromCaixa(uf);
            sendJson(res, 200, { ok: true, data: cities });
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao consultar cidades na CAIXA.";
            sendJson(res, 502, { ok: false, error: message });
            return;
          }
        }

        if (basePath !== "/api/caixa/simulate") {
          next();
          return;
        }

        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Metodo nao permitido." });
          return;
        }

        try {
          const body = await readJsonBody<Partial<OfficialSimulationRequest>>(req);
          const payload = normalizeSimulationRequest(body);

          if (!payload.valorImovel || !payload.rendaMensal || !payload.cidadeCodigo) {
            sendJson(res, 400, { error: "Preencha valor do imovel, renda e cidade." });
            return;
          }

          const official = await simulateWithCaixaOfficial(payload);
          sendJson(res, 200, { ok: true, data: official });
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao consultar CAIXA.";
          sendJson(res, 502, { ok: false, error: message });
          return;
        }
      });
    },
  };
}
