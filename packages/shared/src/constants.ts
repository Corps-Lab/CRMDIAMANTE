export const PORTAL_MENU = [
  "Pagina Inicial",
  "Novidades",
  "Financeiro",
  "Informacoes",
  "Atendimento",
  "Pesquisa",
  "Dados Cadastrais",
  "Meu Perfil",
  "Sair",
] as const;

export const REQUEST_TYPES = ["anticipation", "renegotiation"] as const;
export const REQUEST_STATUS = ["open", "in_review", "approved", "rejected", "completed"] as const;
export const TICKET_STATUS = ["open", "in_progress", "waiting_client", "closed"] as const;
export const CONVERSATION_STATUS = ["new", "open", "pending", "closed"] as const;
export const CONVERSATION_PRIORITY = ["low", "normal", "high", "urgent"] as const;
