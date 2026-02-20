import { safeId } from "@/lib/safeId";

export interface BrokerRegistryRecord {
  id: string;
  userId?: string | null;
  nome: string;
  email: string;
  cpf: string;
  creci?: string | null;
  brokerCode: string;
  createdAt: string;
  updatedAt: string;
}

interface RegisterBrokerInput {
  userId?: string | null;
  nome: string;
  email: string;
  cpf: string;
  creci?: string | null;
  brokerCode?: string;
}

interface BrokerValidationInput {
  brokerCode: string;
  cpf: string;
  creci?: string | null;
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export const normalizeCpf = (value: string) => onlyDigits(value).slice(0, 11);

export const normalizeCreci = (value?: string | null) =>
  value ? value.trim().toUpperCase() : null;

export const normalizeBrokerCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "");

const getStorageKey = (agencyId: string) => `crm_${agencyId}_broker_registry`;

function loadRegistry(agencyId: string): BrokerRegistryRecord[] {
  try {
    const raw = localStorage.getItem(getStorageKey(agencyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrokerRegistryRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function persistRegistry(agencyId: string, records: BrokerRegistryRecord[]) {
  localStorage.setItem(getStorageKey(agencyId), JSON.stringify(records));
}

export function listBrokerRegistry(agencyId: string) {
  return loadRegistry(agencyId);
}

export function generateBrokerCode(agencyId: string, cpf: string) {
  const existingCodes = new Set(
    loadRegistry(agencyId).map((item) => normalizeBrokerCode(item.brokerCode)),
  );
  const cpfSuffix = normalizeCpf(cpf).slice(-3).padStart(3, "0");

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const randomToken = Math.random()
      .toString(36)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4)
      .padEnd(4, "X");
    const code = normalizeBrokerCode(`COR-${cpfSuffix}${randomToken}`);
    if (!existingCodes.has(code)) return code;
  }

  return normalizeBrokerCode(`COR-${cpfSuffix}${Date.now().toString().slice(-4)}`);
}

export function registerBroker(agencyId: string, input: RegisterBrokerInput) {
  const cpf = normalizeCpf(input.cpf);
  if (!cpf) throw new Error("CPF do corretor e obrigatorio para gerar o codigo.");

  const creci = normalizeCreci(input.creci);
  const now = new Date().toISOString();
  const registry = loadRegistry(agencyId);
  const normalizedCode = normalizeBrokerCode(
    input.brokerCode || generateBrokerCode(agencyId, cpf),
  );

  const existingIndex = registry.findIndex((item) => {
    if (input.userId && item.userId && item.userId === input.userId) return true;
    return item.cpf === cpf;
  });

  const nextRecord: BrokerRegistryRecord = {
    id: existingIndex >= 0 ? registry[existingIndex].id : safeId("broker"),
    userId: input.userId || null,
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    cpf,
    creci,
    brokerCode: normalizedCode,
    createdAt: existingIndex >= 0 ? registry[existingIndex].createdAt : now,
    updatedAt: now,
  };

  const nextRegistry = [...registry];
  if (existingIndex >= 0) {
    nextRegistry[existingIndex] = nextRecord;
  } else {
    nextRegistry.unshift(nextRecord);
  }
  persistRegistry(agencyId, nextRegistry);
  return nextRecord;
}

export function validateBrokerByCode(agencyId: string, input: BrokerValidationInput) {
  const code = normalizeBrokerCode(input.brokerCode);
  const cpf = normalizeCpf(input.cpf);
  const creci = normalizeCreci(input.creci);

  if (!code) return { ok: false as const, message: "Informe o codigo do corretor." };
  if (!cpf) return { ok: false as const, message: "Informe o CPF do corretor." };

  const registry = loadRegistry(agencyId);
  const broker = registry.find((item) => normalizeBrokerCode(item.brokerCode) === code);
  if (!broker) {
    return { ok: false as const, message: "Codigo de corretor nao encontrado." };
  }

  if (broker.cpf !== cpf) {
    return { ok: false as const, message: "Codigo informado nao corresponde ao CPF." };
  }

  if (broker.creci) {
    if (!creci) {
      return {
        ok: false as const,
        message: "Este corretor possui CRECI cadastrado. Informe o CRECI para validar.",
      };
    }
    if (broker.creci !== creci) {
      return { ok: false as const, message: "CRECI informado nao confere com o codigo." };
    }
  }

  return { ok: true as const, broker };
}
