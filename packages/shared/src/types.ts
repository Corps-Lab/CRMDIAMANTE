export type UUID = string;

export interface Profile {
  user_id: UUID;
  cpf: string;
  full_name: string;
  phone_e164: string;
  phone_last6: string;
  client_external_id: string | null;
  portal_access_enabled?: boolean;
  email_contact?: string | null;
  address_line?: string | null;
  created_at: string;
}

export interface Agent {
  user_id: UUID;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Contract {
  contract_number: string;
  user_id: UUID;
  development_id: string;
  development_name: string;
  unit_id: string;
  unit_label: string;
  created_at: string;
}

export interface NewsItem {
  id: UUID;
  contract_number: string;
  category: string;
  title: string;
  body: string;
  image_url: string | null;
  published_at: string;
}

export interface DocumentItem {
  id: UUID;
  contract_number: string;
  type: string;
  title: string;
  storage_path: string;
  published_at: string;
}

export interface FinancialBill {
  id: UUID;
  contract_number: string;
  status: "open" | "paid" | "overdue" | "renegotiated";
  amount_cents: number;
  due_date: string;
  competence: string | null;
  barcode_line: string | null;
  bill_pdf_path: string | null;
  created_at: string;
}

export interface FinancialStatementItem {
  id: UUID;
  contract_number: string;
  entry_date: string;
  description: string;
  entry_type: "debit" | "credit";
  amount_cents: number;
  status: string;
  created_at: string;
}

export interface Gallery {
  id: UUID;
  contract_number: string;
  month_ref: string;
  publication_at: string;
  title: string;
  description: string | null;
}

export interface GalleryItem {
  id: UUID;
  gallery_id: UUID;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface Ticket {
  id: UUID;
  contract_number: string;
  created_by_user: UUID;
  subject: string;
  category: string;
  message: string;
  status: "open" | "in_progress" | "waiting_client" | "closed";
  protocol: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: UUID;
  contract_number: string;
  user_id: UUID;
  status: "new" | "open" | "pending" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  assigned_agent_id: UUID | null;
  last_message_at: string;
  created_at: string;
}

export interface Message {
  id: UUID;
  conversation_id: UUID;
  contract_number: string;
  sender_type: "client" | "agent" | "system";
  sender_user_id: UUID | null;
  message_type: "text" | "attachment" | "note" | "system";
  body_text: string | null;
  attachment_id: UUID | null;
  created_at: string;
  read_at_client: string | null;
  read_at_agent: string | null;
}

export interface ClientLoginInput {
  cpf: string;
  pass6: string;
}

export interface ClientLoginResult {
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
  profile: Profile;
  contracts: Contract[];
  locked_until?: string | null;
  remaining_seconds?: number;
}
