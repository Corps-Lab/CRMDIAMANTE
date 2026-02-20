export type AppRole =
  | "ceo"
  | "financeiro"
  | "vendas"
  | "rh"
  | "engenharia"
  | "suporte"
  | "admin"
  | "colaborador";

export type AccessPermission =
  | "dashboard"
  | "clientes"
  | "fornecedores"
  | "obras"
  | "funil"
  | "simulador"
  | "assistencia"
  | "rdo"
  | "rfis"
  | "vistorias"
  | "importar"
  | "contratos"
  | "financeiro"
  | "tarefas"
  | "acessos"
  | "sugestoes"
  | "suporte"
  | "perfil"
  | "progresso";

const ALL_PERMISSIONS: AccessPermission[] = [
  "dashboard",
  "clientes",
  "fornecedores",
  "obras",
  "funil",
  "simulador",
  "assistencia",
  "rdo",
  "rfis",
  "vistorias",
  "importar",
  "contratos",
  "financeiro",
  "tarefas",
  "acessos",
  "sugestoes",
  "suporte",
  "perfil",
  "progresso",
];

const SHARED_SUPPORT_PERMISSIONS: AccessPermission[] = [
  "sugestoes",
  "suporte",
  "perfil",
];

const ROLE_PERMISSIONS: Record<AppRole, AccessPermission[]> = {
  ceo: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  financeiro: [
    "dashboard",
    ...SHARED_SUPPORT_PERMISSIONS,
    "clientes",
    "fornecedores",
    "funil",
    "importar",
    "contratos",
    "financeiro",
    "simulador",
  ],
  vendas: [
    ...SHARED_SUPPORT_PERMISSIONS,
    "clientes",
    "funil",
    "simulador",
    "importar",
    "contratos",
    "tarefas",
  ],
  rh: [
    ...SHARED_SUPPORT_PERMISSIONS,
    "importar",
    "contratos",
    "tarefas",
  ],
  engenharia: [
    ...SHARED_SUPPORT_PERMISSIONS,
    "clientes",
    "fornecedores",
    "obras",
    "assistencia",
    "rdo",
    "rfis",
    "vistorias",
    "importar",
    "contratos",
    "tarefas",
  ],
  suporte: [
    ...SHARED_SUPPORT_PERMISSIONS,
    "tarefas",
  ],
  colaborador: [
    ...SHARED_SUPPORT_PERMISSIONS,
    "tarefas",
  ],
};

const PATH_PERMISSION_MAP: Record<string, AccessPermission> = {
  "/": "dashboard",
  "/clientes": "clientes",
  "/fornecedores": "fornecedores",
  "/obras": "obras",
  "/funil": "funil",
  "/simulador-caixa": "simulador",
  "/assistencia": "assistencia",
  "/rdo": "rdo",
  "/rfis": "rfis",
  "/vistorias": "vistorias",
  "/importar": "importar",
  "/contratos": "contratos",
  "/entradas": "financeiro",
  "/despesas": "financeiro",
  "/tarefas": "tarefas",
  "/acessos": "acessos",
  "/sugestoes": "sugestoes",
  "/suporte": "suporte",
  "/portal-cliente": "suporte",
  "/perfil": "perfil",
  "/progresso": "progresso",
};

const HOME_PATH_FALLBACKS: string[] = [
  "/",
  "/clientes",
  "/fornecedores",
  "/obras",
  "/contratos",
  "/tarefas",
  "/suporte",
  "/perfil",
];

const NORMALIZED_ROLE_MAP: Record<string, AppRole> = {
  ceo: "ceo",
  admin: "admin",
  financeiro: "financeiro",
  vendas: "vendas",
  rh: "rh",
  engenharia: "engenharia",
  suporte: "suporte",
  colaborador: "colaborador",
};

export const ROLE_OPTIONS: Array<{
  value: AppRole;
  label: string;
  description: string;
}> = [
  { value: "ceo", label: "CEO", description: "Acesso completo ao CRM." },
  {
    value: "financeiro",
    label: "Financeiro",
    description: "Dashboard, financeiro, clientes, fornecedores, contratos, importar CSV, funil e simulador CAIXA.",
  },
  {
    value: "vendas",
    label: "Vendas",
    description: "Clientes, contratos, tarefas, importar CSV, funil de vendas e simulador CAIXA.",
  },
  {
    value: "rh",
    label: "RH",
    description: "Importar CSV, contratos e tarefas.",
  },
  {
    value: "engenharia",
    label: "Engenharia",
    description:
      "Obras, assistencia tecnica, RDO, RFI, vistorias, importar CSV, contratos, fornecedores, clientes e tarefas.",
  },
  {
    value: "suporte",
    label: "Suporte",
    description: "Atendimento, sugestoes/reclamacoes e tarefas.",
  },
];

export const LEGACY_DB_ROLES = ["admin", "colaborador"] as const;
export type LegacyDbRole = (typeof LEGACY_DB_ROLES)[number];

export function normalizeRole(input: unknown): AppRole | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  return NORMALIZED_ROLE_MAP[normalized] ?? null;
}

export function toLegacyDbRole(role: AppRole): LegacyDbRole {
  return role === "ceo" || role === "admin" ? "admin" : "colaborador";
}

export function canAccessPermission(
  role: AppRole | null | undefined,
  permission: AccessPermission,
) {
  if (!role) return false;
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  return ROLE_PERMISSIONS[normalizedRole].includes(permission);
}

export function canAccessPath(role: AppRole | null | undefined, path: string) {
  const normalizedPath = path === "" ? "/" : path;
  const permission = PATH_PERMISSION_MAP[normalizedPath];
  if (!permission) return true;
  return canAccessPermission(role, permission);
}

export function getHomePathForRole(role: AppRole | null | undefined) {
  for (const path of HOME_PATH_FALLBACKS) {
    if (canAccessPath(role, path)) return path;
  }
  return "/suporte";
}

export function getRoleLabel(role: AppRole | null | undefined) {
  switch (normalizeRole(role)) {
    case "ceo":
      return "CEO";
    case "admin":
      return "Administrador";
    case "financeiro":
      return "Financeiro";
    case "vendas":
      return "Vendas";
    case "rh":
      return "RH";
    case "engenharia":
      return "Engenharia";
    case "suporte":
      return "Suporte";
    case "colaborador":
      return "Colaborador";
    default:
      return "Sem perfil";
  }
}

export function getRoleDescription(role: AppRole | null | undefined) {
  const normalizedRole = normalizeRole(role);
  const selected = ROLE_OPTIONS.find((option) => option.value === normalizedRole);
  if (selected) return selected.description;
  if (normalizedRole === "admin") return "Acesso total ao sistema.";
  if (normalizedRole === "colaborador") {
    return "Acesso a tarefas, suporte e sugestoes/reclamacoes.";
  }
  return "Sem permissoes definidas.";
}
