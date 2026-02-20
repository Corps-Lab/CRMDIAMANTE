import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PORTAL_MENU,
  invokeClientLogin,
  getSignedUrl,
  globalSearch,
  normalizeCpf,
  normalizePass6,
  isValidCpf,
  isValidPass6,
  type Contract,
  type Conversation,
  type FinancialBill,
  type FinancialStatementItem,
  type Gallery,
  type GalleryItem,
  type Message,
  type NewsItem,
  type Profile,
  type Ticket,
} from "@crm/shared";
import { edgeOptions, supabase } from "./supabase";

const NEWS_PAGE_SIZE = 5;
const MENU_LABELS: Record<(typeof PORTAL_MENU)[number], string> = {
  "Pagina Inicial": "Página Inicial",
  Novidades: "Novidades",
  Financeiro: "Financeiro",
  Informacoes: "Informações",
  Atendimento: "Atendimento",
  Pesquisa: "Pesquisa",
  "Dados Cadastrais": "Dados Cadastrais",
  "Meu Perfil": "Meu Perfil",
  Sair: "Sair",
};

type MenuItem = (typeof PORTAL_MENU)[number];

type ReadTrackingItem = {
  item_type: "news" | "document";
  item_id: string;
};

type DocumentItem = {
  id: string;
  contract_number: string;
  type: string;
  title: string;
  storage_path: string;
  published_at: string;
};

type UserSettings = {
  user_id: string;
  email_notifications: boolean;
  whatsapp_notifications: boolean;
};

type SearchGrouped = {
  groups?: Record<
    string,
    Array<{ type: string; id: string; title: string; snippet: string; link_target: string }>
  >;
  total?: number;
};

type LoadState = {
  news: NewsItem[];
  bills: FinancialBill[];
  statement: FinancialStatementItem[];
  documents: DocumentItem[];
  progress: { progress_percent: number; stages: Array<Record<string, unknown>> } | null;
  galleries: Gallery[];
  tickets: Ticket[];
  faq: Array<{ id: string; category: string; question: string; answer: string }>;
  readTracking: ReadTrackingItem[];
};

const emptyLoadState: LoadState = {
  news: [],
  bills: [],
  statement: [],
  documents: [],
  progress: null,
  galleries: [],
  tickets: [],
  faq: [],
  readTracking: [],
};

function toCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCpfMask(input: string) {
  const digits = normalizeCpf(input).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function toCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTableAsPdfLike(title: string, htmlRows: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`
    <html>
      <head><title>${title}</title></head>
      <body>
        <h2>${title}</h2>
        <table border="1" cellspacing="0" cellpadding="6">
          ${htmlRows}
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.print();
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function messageError(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const logoUrl = `${import.meta.env.BASE_URL}logo-diamante.png`;

  const [menu, setMenu] = useState<MenuItem>("Pagina Inicial");
  const [loadingSession, setLoadingSession] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loginCpf, setLoginCpf] = useState("");
  const [loginPass6, setLoginPass6] = useState("");
  const [lockUntil, setLockUntil] = useState<string | null>(null);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);
  const [contractFromLink, setContractFromLink] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState("");
  const [mustSelectContract, setMustSelectContract] = useState(false);

  const [data, setData] = useState<LoadState>(emptyLoadState);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);

  const [newsCategory, setNewsCategory] = useState("all");
  const [newsVisible, setNewsVisible] = useState(NEWS_PAGE_SIZE);

  const [statementDateFrom, setStatementDateFrom] = useState("");
  const [statementDateTo, setStatementDateTo] = useState("");
  const [statementStatus, setStatementStatus] = useState("all");
  const [statementType, setStatementType] = useState("all");

  const [anticipationBillId, setAnticipationBillId] = useState("");
  const [anticipationInstallments, setAnticipationInstallments] = useState(1);

  const [renegotiationReason, setRenegotiationReason] = useState("");
  const [renegotiationFiles, setRenegotiationFiles] = useState<File[]>([]);

  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [docDateFrom, setDocDateFrom] = useState("");
  const [docDateTo, setDocDateTo] = useState("");
  const [docUnreadOnly, setDocUnreadOnly] = useState(false);

  const [faqQuery, setFaqQuery] = useState("");

  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("general");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);

  const [searchQ, setSearchQ] = useState("");
  const [searchResult, setSearchResult] = useState<SearchGrouped | null>(null);

  const [proposedChanges, setProposedChanges] = useState("");

  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<Array<{ id: string; caption: string; url: string }>>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cpfFromQuery = normalizeCpf(params.get("cpf") || "");
    const contractFromQuery = (params.get("contract") || "").trim();
    if (cpfFromQuery) {
      setLoginCpf(formatCpfMask(cpfFromQuery));
    }
    if (contractFromQuery) {
      setContractFromLink(contractFromQuery);
    }
  }, [location.search]);

  const currentContract = useMemo(
    () => contracts.find((item) => item.contract_number === selectedContract) || null,
    [contracts, selectedContract],
  );

  const readNewsIds = useMemo(
    () => new Set(data.readTracking.filter((r) => r.item_type === "news").map((r) => r.item_id)),
    [data.readTracking],
  );

  const readDocIds = useMemo(
    () => new Set(data.readTracking.filter((r) => r.item_type === "document").map((r) => r.item_id)),
    [data.readTracking],
  );

  const filteredNews = useMemo(() => {
    const byCategory =
      newsCategory === "all" ? data.news : data.news.filter((item) => item.category === newsCategory);
    return byCategory.slice(0, newsVisible);
  }, [data.news, newsCategory, newsVisible]);

  const filteredStatement = useMemo(() => {
    return data.statement.filter((item) => {
      if (statementStatus !== "all" && item.status !== statementStatus) return false;
      if (statementType !== "all" && item.entry_type !== statementType) return false;
      if (statementDateFrom && item.entry_date < statementDateFrom) return false;
      if (statementDateTo && item.entry_date > statementDateTo) return false;
      return true;
    });
  }, [data.statement, statementStatus, statementType, statementDateFrom, statementDateTo]);

  const filteredDocuments = useMemo(() => {
    return data.documents.filter((item) => {
      if (docTypeFilter !== "all" && item.type !== docTypeFilter) return false;
      if (docDateFrom && item.published_at.slice(0, 10) < docDateFrom) return false;
      if (docDateTo && item.published_at.slice(0, 10) > docDateTo) return false;
      if (docUnreadOnly && readDocIds.has(item.id)) return false;
      return true;
    });
  }, [data.documents, docTypeFilter, docDateFrom, docDateTo, docUnreadOnly, readDocIds]);

  const filteredFaq = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return data.faq;
    return data.faq.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [data.faq, faqQuery]);

  const openBills = useMemo(
    () => data.bills.filter((item) => item.status === "open" || item.status === "overdue"),
    [data.bills],
  );

  const nextDueBill = useMemo(() => {
    const sorted = [...openBills].sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));
    return sorted[0] || null;
  }, [openBills]);

  const lastTicket = useMemo(() => data.tickets[0] || null, [data.tickets]);

  const anticipatedBill = useMemo(
    () => openBills.find((item) => item.id === anticipationBillId) || null,
    [openBills, anticipationBillId],
  );

  const anticipationSimulation = useMemo(() => {
    if (!anticipatedBill) return null;
    const discountRate = Math.min(0.12, Math.max(0.01, anticipationInstallments * 0.01));
    const discount = Math.round(anticipatedBill.amount_cents * discountRate);
    const final = anticipatedBill.amount_cents - discount;
    return {
      discountRate,
      discount,
      final,
    };
  }, [anticipatedBill, anticipationInstallments]);

  useEffect(() => {
    if (!lockUntil) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 1000));
      setLockRemainingSeconds(remaining);
      if (remaining <= 0) {
        setLockUntil(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockUntil]);

  async function loadSession() {
    setLoadingSession(true);
    const { data: sessionRes } = await supabase.auth.getSession();
    const uid = sessionRes.session?.user.id;

    if (!uid) {
      setProfile(null);
      setContracts([]);
      setSelectedContract("");
      setMustSelectContract(false);
      setLoadingSession(false);
      return;
    }

    const [{ data: profileData }, { data: contractsData }, { data: settingsData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("contracts").select("*").eq("user_id", uid).order("contract_number"),
      supabase.from("user_settings").select("*").eq("user_id", uid).maybeSingle(),
    ]);

    const profileValue = (profileData || null) as Profile | null;
    const contractsValue = (contractsData || []) as Contract[];
    setProfile(profileValue);
    setContracts(contractsValue);

    if (settingsData) {
      setSettings(settingsData as UserSettings);
    } else if (profileValue) {
      const insertSettings = await supabase
        .from("user_settings")
        .insert({
          user_id: profileValue.user_id,
          email_notifications: true,
          whatsapp_notifications: true,
        })
        .select("*")
        .single();
      if (!insertSettings.error && insertSettings.data) {
        setSettings(insertSettings.data as UserSettings);
      }
    }

    const savedContract = localStorage.getItem("portal_selected_contract") || "";
    const linkedContract =
      contractFromLink && contractsValue.some((item) => item.contract_number === contractFromLink)
        ? contractFromLink
        : "";
    const preferredContract = linkedContract || savedContract;

    if (contractsValue.length > 1 && !preferredContract) {
      setSelectedContract("");
      setMustSelectContract(true);
    } else {
      const selected =
        contractsValue.find((item) => item.contract_number === preferredContract)?.contract_number ||
        contractsValue[0]?.contract_number ||
        "";
      setSelectedContract(selected);
      setMustSelectContract(false);
    }

    setLoadingSession(false);
  }

  async function loadContractData(contractNumber: string) {
    if (!contractNumber || !profile) return;

    const nowIso = new Date().toISOString();

    const [
      newsRes,
      billsRes,
      statementRes,
      documentsRes,
      progressRes,
      galleriesRes,
      ticketsRes,
      faqRes,
      readRes,
      convRes,
    ] = await Promise.all([
      supabase
        .from("news")
        .select("*")
        .eq("contract_number", contractNumber)
        .order("published_at", { ascending: false }),
      supabase
        .from("financial_bills")
        .select("*")
        .eq("contract_number", contractNumber)
        .order("due_date", { ascending: false }),
      supabase
        .from("financial_statement")
        .select("*")
        .eq("contract_number", contractNumber)
        .order("entry_date", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .eq("contract_number", contractNumber)
        .order("published_at", { ascending: false }),
      supabase.from("construction_progress").select("*").eq("contract_number", contractNumber).maybeSingle(),
      supabase
        .from("photo_galleries")
        .select("*")
        .eq("contract_number", contractNumber)
        .lte("publication_at", nowIso)
        .order("month_ref", { ascending: false }),
      supabase
        .from("tickets")
        .select("*")
        .eq("contract_number", contractNumber)
        .order("created_at", { ascending: false }),
      supabase.from("faq").select("id,category,question,answer").order("sort_order", { ascending: true }),
      supabase
        .from("read_tracking")
        .select("item_type,item_id")
        .eq("user_id", profile.user_id)
        .eq("contract_number", contractNumber)
        .in("item_type", ["news", "document"]),
      supabase.from("conversations").select("*").eq("contract_number", contractNumber).maybeSingle(),
    ]);

    setData({
      news: (newsRes.data || []) as NewsItem[],
      bills: (billsRes.data || []) as FinancialBill[],
      statement: (statementRes.data || []) as FinancialStatementItem[],
      documents: (documentsRes.data || []) as DocumentItem[],
      progress: (progressRes.data || null) as { progress_percent: number; stages: Array<Record<string, unknown>> } | null,
      galleries: (galleriesRes.data || []) as Gallery[],
      tickets: (ticketsRes.data || []) as Ticket[],
      faq: (faqRes.data || []) as Array<{ id: string; category: string; question: string; answer: string }>,
      readTracking: (readRes.data || []) as ReadTrackingItem[],
    });

    const conversationData = (convRes.data || null) as Conversation | null;
    setConversation(conversationData);

    if (conversationData) {
      await loadConversationMessages(conversationData);
    } else {
      setMessages([]);
    }
  }

  async function loadConversationMessages(conv: Conversation) {
    const messagesRes = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    const rows = (messagesRes.data || []) as Message[];
    setMessages(rows);

    const unreadForClient = rows
      .filter((item) => item.sender_type !== "client" && !item.read_at_client)
      .map((item) => item.id);

    if (unreadForClient.length > 0) {
      await supabase
        .from("messages")
        .update({ read_at_client: new Date().toISOString() })
        .in("id", unreadForClient);
    }
  }

  useEffect(() => {
    loadSession().catch((error) => {
      setAuthError(messageError(error));
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSession().catch((error) => {
        setAuthError(messageError(error));
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) {
      if (location.pathname !== "/login") navigate("/login", { replace: true });
      return;
    }

    if (mustSelectContract) {
      if (location.pathname !== "/selecionar-contrato") {
        navigate("/selecionar-contrato", { replace: true });
      }
      return;
    }

    if (location.pathname === "/login" || location.pathname === "/selecionar-contrato") {
      navigate("/", { replace: true });
    }
  }, [profile, mustSelectContract, location.pathname, navigate]);

  useEffect(() => {
    if (!profile || !selectedContract) return;
    localStorage.setItem("portal_selected_contract", selectedContract);
    loadContractData(selectedContract).catch((error) => setAuthError(messageError(error)));
  }, [profile, selectedContract]);

  useEffect(() => {
    if (!profile || !contractFromLink || contracts.length === 0) return;
    const hasLinked = contracts.some((item) => item.contract_number === contractFromLink);
    if (hasLinked) {
      setSelectedContract(contractFromLink);
      setMustSelectContract(false);
    }
  }, [profile, contractFromLink, contracts]);

  useEffect(() => {
    if (!selectedContract) return;

    const channel = supabase
      .channel(`portal-realtime-${selectedContract}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `contract_number=eq.${selectedContract}` },
        async () => {
          if (!conversation) return;
          await loadConversationMessages(conversation);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `contract_number=eq.${selectedContract}` },
        async () => {
          const convRes = await supabase
            .from("conversations")
            .select("*")
            .eq("contract_number", selectedContract)
            .maybeSingle();
          const conv = (convRes.data || null) as Conversation | null;
          setConversation(conv);
          if (conv) await loadConversationMessages(conv);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `contract_number=eq.${selectedContract}` },
        async () => {
          const ticketsRes = await supabase
            .from("tickets")
            .select("*")
            .eq("contract_number", selectedContract)
            .order("created_at", { ascending: false });
          setData((current) => ({ ...current, tickets: (ticketsRes.data || []) as Ticket[] }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContract, conversation]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");

    const cpf = normalizeCpf(loginCpf);
    const pass6 = normalizePass6(loginPass6);

    if (!isValidCpf(cpf)) {
      setAuthError("CPF invalido.");
      return;
    }
    if (!isValidPass6(pass6)) {
      setAuthError("Senha deve conter 6 digitos numericos.");
      return;
    }

    try {
      const res = await invokeClientLogin({ cpf, pass6 }, edgeOptions);
      await supabase.auth.setSession({
        access_token: res.session.access_token,
        refresh_token: res.session.refresh_token,
      });

      setProfile(res.profile);
      setContracts(res.contracts);
      const linkedContract =
        contractFromLink && res.contracts.some((item) => item.contract_number === contractFromLink)
          ? contractFromLink
          : "";
      const selectedContract =
        linkedContract || (res.contracts.length === 1 ? res.contracts[0].contract_number : "");
      setSelectedContract(selectedContract);
      setMustSelectContract(res.contracts.length > 1 && !selectedContract);
      setLockUntil(null);
      setLockRemainingSeconds(0);
      setLoginCpf("");
      setLoginPass6("");
      navigate(res.contracts.length > 1 && !selectedContract ? "/selecionar-contrato" : "/", { replace: true });
    } catch (error) {
      const e = error as Error & { status?: number; data?: Record<string, unknown> | null };
      setAuthError(e.message || "Falha no login.");

      const lockedUntilValue =
        e.data && typeof e.data.locked_until === "string" ? e.data.locked_until : null;
      const remainingValue =
        e.data && typeof e.data.remaining_seconds === "number" ? e.data.remaining_seconds : 0;

      if (e.status === 423 && lockedUntilValue) {
        setLockUntil(lockedUntilValue);
        setLockRemainingSeconds(remainingValue);
      }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setContracts([]);
    setSelectedContract("");
    setMustSelectContract(false);
    setData(emptyLoadState);
    setSettings(null);
    setConversation(null);
    setMessages([]);
    localStorage.removeItem("portal_selected_contract");
    navigate("/login", { replace: true });
  }

  async function chooseContract(contractNumber: string) {
    setSelectedContract(contractNumber);
    setMustSelectContract(false);
    navigate("/", { replace: true });
  }

  async function markAsRead(itemType: "news" | "document", itemId: string) {
    if (!profile || !selectedContract) return;
    const res = await supabase.from("read_tracking").upsert(
      {
        user_id: profile.user_id,
        contract_number: selectedContract,
        item_type: itemType,
        item_id: itemId,
      },
      { onConflict: "user_id,contract_number,item_type,item_id" },
    );
    if (res.error) {
      setAuthError(res.error.message);
      return;
    }

    setData((current) => ({
      ...current,
      readTracking: current.readTracking.some(
        (item) => item.item_type === itemType && item.item_id === itemId,
      )
        ? current.readTracking
        : [...current.readTracking, { item_type: itemType, item_id: itemId }],
    }));
  }

  async function openSignedFile(bucket: string, path: string, markRead?: { type: "news" | "document"; id: string }) {
    try {
      const token = await getAccessToken();
      const { signedUrl } = await getSignedUrl(
        { bucket, path, expiresIn: 120 },
        { ...edgeOptions, accessToken: token },
      );
      if (markRead) await markAsRead(markRead.type, markRead.id);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setAuthError(messageError(error));
    }
  }

  async function copyBarcode(barcode: string | null) {
    if (!barcode) return;
    try {
      await navigator.clipboard.writeText(barcode);
    } catch (_error) {
      const textArea = document.createElement("textarea");
      textArea.value = barcode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }

  async function submitAnticipationRequest() {
    if (!selectedContract || !profile || !anticipatedBill || !anticipationSimulation) return;

    const payload = {
      bill_id: anticipatedBill.id,
      installments: anticipationInstallments,
      simulated_discount_cents: anticipationSimulation.discount,
      simulated_final_cents: anticipationSimulation.final,
    };

    const res = await supabase.from("requests").insert({
      contract_number: selectedContract,
      request_type: "anticipation",
      payload,
      status: "open",
      created_by_user: profile.user_id,
    });

    if (res.error) {
      setAuthError(res.error.message);
      return;
    }
  }

  async function submitRenegotiationRequest() {
    if (!selectedContract || !profile || !renegotiationReason.trim()) return;

    const createRes = await supabase
      .from("requests")
      .insert({
        contract_number: selectedContract,
        request_type: "renegotiation",
        payload: {
          reason: renegotiationReason,
          attachments: [],
        },
        status: "open",
        created_by_user: profile.user_id,
      })
      .select("id,payload")
      .single();

    if (createRes.error || !createRes.data) {
      setAuthError(createRes.error?.message || "Falha ao criar solicitacao.");
      return;
    }

    const uploadedPaths: string[] = [];
    for (const file of renegotiationFiles) {
      const objectPath = `${selectedContract}/${createRes.data.id}/${crypto.randomUUID()}`;
      const up = await supabase.storage.from("tickets").upload(objectPath, file, { upsert: false });
      if (!up.error) uploadedPaths.push(objectPath);
    }

    await supabase
      .from("requests")
      .update({ payload: { ...(createRes.data.payload || {}), reason: renegotiationReason, attachments: uploadedPaths } })
      .eq("id", createRes.data.id);

    setRenegotiationReason("");
    setRenegotiationFiles([]);
  }

  async function openGalleryMonth(galleryId: string) {
    if (!selectedContract) return;

    const itemsRes = await supabase
      .from("photo_gallery_items")
      .select("*")
      .eq("gallery_id", galleryId)
      .order("sort_order", { ascending: true });

    const items = (itemsRes.data || []) as GalleryItem[];
    const token = await getAccessToken();

    const urls: Array<{ id: string; caption: string; url: string }> = [];
    for (const item of items) {
      try {
        const signed = await getSignedUrl(
          { bucket: "gallery", path: item.storage_path, expiresIn: 120 },
          { ...edgeOptions, accessToken: token },
        );
        urls.push({ id: item.id, caption: item.caption || "", url: signed.signedUrl });
      } catch (_error) {
        // ignore individual image failures
      }
    }

    if (!urls.length) return;
    setGalleryImages(urls);
    setGalleryIndex(0);
    setGalleryModalOpen(true);
  }

  async function submitTicket() {
    if (!selectedContract || !profile || !ticketSubject.trim() || !ticketMessage.trim()) return;

    const createRes = await supabase
      .from("tickets")
      .insert({
        contract_number: selectedContract,
        created_by_user: profile.user_id,
        subject: ticketSubject,
        category: ticketCategory,
        message: ticketMessage,
        status: "open",
      })
      .select("id,protocol")
      .single();

    if (createRes.error || !createRes.data) {
      setAuthError(createRes.error?.message || "Falha ao abrir ticket.");
      return;
    }

    for (const file of ticketFiles) {
      const fileId = crypto.randomUUID();
      const objectPath = `${selectedContract}/${createRes.data.id}/${fileId}`;
      const upload = await supabase.storage.from("tickets").upload(objectPath, file, { upsert: false });
      if (upload.error) continue;

      await supabase.from("ticket_attachments").insert({
        ticket_id: createRes.data.id,
        storage_path: objectPath,
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      });
    }

    setTicketSubject("");
    setTicketCategory("general");
    setTicketMessage("");
    setTicketFiles([]);
    await loadContractData(selectedContract);
  }

  async function ensureConversation(): Promise<Conversation | null> {
    if (!profile || !selectedContract) return null;
    if (conversation) return conversation;

    const createRes = await supabase
      .from("conversations")
      .insert({
        contract_number: selectedContract,
        user_id: profile.user_id,
        status: "new",
        priority: "normal",
      })
      .select("*")
      .single();

    if (createRes.error || !createRes.data) {
      setAuthError(createRes.error?.message || "Falha ao iniciar conversa.");
      return null;
    }

    const conv = createRes.data as Conversation;
    setConversation(conv);
    return conv;
  }

  async function sendChatMessage() {
    if (!profile || !selectedContract || (!chatText.trim() && !chatFile)) return;

    const conv = await ensureConversation();
    if (!conv) return;

    let attachmentId: string | null = null;
    let messageType: "text" | "attachment" = "text";

    if (chatFile) {
      const objectPath = `${selectedContract}/${conv.id}/${crypto.randomUUID()}`;
      const up = await supabase.storage.from("chat").upload(objectPath, chatFile, { upsert: false });
      if (up.error) {
        setAuthError(up.error.message);
        return;
      }

      const attachment = await supabase
        .from("chat_attachments")
        .insert({
          conversation_id: conv.id,
          contract_number: selectedContract,
          storage_path: objectPath,
          filename: chatFile.name,
          mime_type: chatFile.type || "application/octet-stream",
          size_bytes: chatFile.size,
        })
        .select("id")
        .single();

      if (attachment.error || !attachment.data) {
        setAuthError(attachment.error?.message || "Falha no anexo.");
        return;
      }

      attachmentId = attachment.data.id as string;
      messageType = "attachment";
    }

    const msgRes = await supabase.from("messages").insert({
      conversation_id: conv.id,
      contract_number: selectedContract,
      sender_type: "client",
      sender_user_id: profile.user_id,
      message_type: messageType,
      body_text: chatText.trim() || null,
      attachment_id: attachmentId,
    });

    if (msgRes.error) {
      setAuthError(msgRes.error.message);
      return;
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), status: "open" })
      .eq("id", conv.id);

    setChatText("");
    setChatFile(null);
    await loadConversationMessages(conv);
  }

  async function submitGlobalSearch() {
    if (!selectedContract || !searchQ.trim()) return;
    try {
      const token = await getAccessToken();
      const res = await globalSearch(
        {
          q: searchQ.trim(),
          contract_number: selectedContract,
        },
        {
          ...edgeOptions,
          accessToken: token,
        },
      );
      setSearchResult(res as SearchGrouped);
    } catch (error) {
      setAuthError(messageError(error));
    }
  }

  async function submitCadastroChangeTicket() {
    if (!profile || !selectedContract) return;
    const payload = {
      kind: "cadastro_change_request",
      proposed_changes: proposedChanges,
      current_profile: {
        full_name: profile.full_name,
        cpf: profile.cpf,
        phone_e164: profile.phone_e164,
        email_contact: profile.email_contact || "",
        address_line: profile.address_line || "",
      },
    };

    const res = await supabase.from("tickets").insert({
      contract_number: selectedContract,
      created_by_user: profile.user_id,
      subject: "Solicitacao de alteracao cadastral",
      category: "registration_change",
      message: JSON.stringify(payload),
      status: "open",
    });

    if (res.error) {
      setAuthError(res.error.message);
      return;
    }

    setProposedChanges("");
    await loadContractData(selectedContract);
  }

  async function saveSettings(next: UserSettings) {
    const res = await supabase.from("user_settings").upsert(next, { onConflict: "user_id" }).select("*").single();
    if (res.error) {
      setAuthError(res.error.message);
      return;
    }
    setSettings(res.data as UserSettings);
  }

  function renderDashboard() {
    return (
      <section className="list">
        <div className="grid">
          <div className="card">
            <h3>Contrato e Unidade</h3>
            <p>
              {currentContract?.contract_number} - {currentContract?.development_name} - {currentContract?.unit_label}
            </p>
          </div>
          <div className="card">
            <h3>Financeiro rapido</h3>
            <p>Boletos em aberto: {openBills.length}</p>
            <p>Proximo vencimento: {nextDueBill ? formatDate(nextDueBill.due_date) : "-"}</p>
          </div>
          <div className="card">
            <h3>Andamento da obra</h3>
            <p>{data.progress?.progress_percent ?? 0}%</p>
            <p>Etapas: {(data.progress?.stages || []).length}</p>
          </div>
          <div className="card">
            <h3>Atendimento</h3>
            <p>Ultimo ticket: {lastTicket?.protocol || "-"}</p>
            <p>Status: {lastTicket?.status || "-"}</p>
          </div>
        </div>

        <div className="card">
          <h3>Comunicacoes recentes</h3>
          {data.documents.slice(0, 3).map((doc) => (
            <div key={doc.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                {doc.title} ({formatDate(doc.published_at)})
              </span>
              <button className="secondary" onClick={() => openSignedFile("documents", doc.storage_path, { type: "document", id: doc.id })}>
                Abrir
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Acoes rapidas</h3>
          <div className="row">
            <button className="secondary" onClick={() => setMenu("Financeiro")}>2a via de boleto</button>
            <button className="secondary" onClick={() => setMenu("Financeiro")}>Extrato financeiro</button>
            <button className="secondary" onClick={() => setMenu("Informacoes")}>Andamento da Obra</button>
            <button className="secondary" onClick={() => setMenu("Atendimento")}>Chat / Fale Conosco</button>
          </div>
        </div>
      </section>
    );
  }

  function renderNovidades() {
    return (
      <section className="list">
        <div className="card row">
          <select value={newsCategory} onChange={(e) => { setNewsCategory(e.target.value); setNewsVisible(NEWS_PAGE_SIZE); }}>
            <option value="all">Todas categorias</option>
            <option value="Work">Work</option>
            <option value="Financial">Financial</option>
            <option value="Communications">Communications</option>
          </select>
        </div>

        {filteredNews.map((item) => (
          <article key={item.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{item.title}</strong>
              <span>{item.category}</span>
            </div>
            <p>{item.body}</p>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <small>{formatDate(item.published_at)}</small>
              <button className="secondary" onClick={() => markAsRead("news", item.id)}>
                {readNewsIds.has(item.id) ? "Lida" : "Marcar como lida"}
              </button>
            </div>
          </article>
        ))}

        {newsVisible < (newsCategory === "all" ? data.news.length : data.news.filter((n) => n.category === newsCategory).length) ? (
          <button className="secondary" onClick={() => setNewsVisible((prev) => prev + NEWS_PAGE_SIZE)}>
            Carregar mais
          </button>
        ) : null}
      </section>
    );
  }

  function renderFinanceiro() {
    return (
      <section className="list">
        <div className="card">
          <h3>Segunda via de boleto</h3>
          {data.bills.map((bill) => (
            <div key={bill.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{toCurrency(bill.amount_cents)}</strong>
                <span>{bill.status}</span>
              </div>
              <p>Vencimento: {formatDate(bill.due_date)}</p>
              <p>Competencia: {bill.competence || "-"}</p>
              <div className="row">
                <button className="secondary" onClick={() => copyBarcode(bill.barcode_line)} disabled={!bill.barcode_line}>
                  Copiar codigo de barras
                </button>
                <button
                  className="secondary"
                  onClick={() => bill.bill_pdf_path && openSignedFile("bills", bill.bill_pdf_path)}
                  disabled={!bill.bill_pdf_path}
                >
                  Abrir PDF
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Extrato financeiro</h3>
          <div className="row">
            <input type="date" value={statementDateFrom} onChange={(e) => setStatementDateFrom(e.target.value)} />
            <input type="date" value={statementDateTo} onChange={(e) => setStatementDateTo(e.target.value)} />
            <select value={statementStatus} onChange={(e) => setStatementStatus(e.target.value)}>
              <option value="all">Status (todos)</option>
              <option value="confirmed">confirmed</option>
              <option value="paid">paid</option>
              <option value="overdue">overdue</option>
            </select>
            <select value={statementType} onChange={(e) => setStatementType(e.target.value)}>
              <option value="all">Tipo (todos)</option>
              <option value="debit">debit</option>
              <option value="credit">credit</option>
            </select>
          </div>
          {filteredStatement.map((item) => (
            <div key={item.id} className="card">
              <strong>{item.description}</strong>
              <p>
                {item.entry_date} - {item.entry_type} - {toCurrency(item.amount_cents)} - {item.status}
              </p>
            </div>
          ))}
          <div className="row">
            <button
              className="secondary"
              onClick={() =>
                toCsv(
                  "extrato.csv",
                  ["data", "descricao", "tipo", "valor", "status"],
                  filteredStatement.map((item) => [
                    item.entry_date,
                    item.description,
                    item.entry_type,
                    String(item.amount_cents / 100),
                    item.status,
                  ]),
                )
              }
            >
              Exportar CSV
            </button>
            <button
              className="secondary"
              onClick={() =>
                exportTableAsPdfLike(
                  "Extrato Financeiro",
                  filteredStatement
                    .map(
                      (item) =>
                        `<tr><td>${item.entry_date}</td><td>${item.description}</td><td>${item.entry_type}</td><td>${toCurrency(item.amount_cents)}</td><td>${item.status}</td></tr>`,
                    )
                    .join(""),
                )
              }
            >
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Antecipacao</h3>
          <div className="row">
            <select value={anticipationBillId} onChange={(e) => setAnticipationBillId(e.target.value)}>
              <option value="">Selecione parcela elegivel</option>
              {openBills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.id.slice(0, 8)} - {toCurrency(bill.amount_cents)} - {bill.status}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={12}
              value={anticipationInstallments}
              onChange={(e) => setAnticipationInstallments(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          {anticipationSimulation ? (
            <div className="card">
              <p>Desconto simulado: {(anticipationSimulation.discountRate * 100).toFixed(2)}%</p>
              <p>Desconto em valor: {toCurrency(anticipationSimulation.discount)}</p>
              <p>Valor final estimado: {toCurrency(anticipationSimulation.final)}</p>
            </div>
          ) : null}
          <button className="primary" onClick={submitAnticipationRequest} disabled={!anticipationSimulation}>
            Solicitar antecipacao
          </button>
        </div>

        <div className="card">
          <h3>Renegociacao</h3>
          <textarea value={renegotiationReason} onChange={(e) => setRenegotiationReason(e.target.value)} placeholder="Motivo da renegociacao" />
          <input type="file" multiple onChange={(e) => setRenegotiationFiles(Array.from(e.target.files || []))} />
          <button className="primary" onClick={submitRenegotiationRequest}>
            Enviar solicitacao
          </button>
        </div>
      </section>
    );
  }

  function renderInformacoes() {
    return (
      <section className="list">
        <div className="card">
          <h3>Documentos e comunicados</h3>
          <div className="row">
            <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
              <option value="all">Tipo (todos)</option>
              {Array.from(new Set(data.documents.map((d) => d.type))).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input type="date" value={docDateFrom} onChange={(e) => setDocDateFrom(e.target.value)} />
            <input type="date" value={docDateTo} onChange={(e) => setDocDateTo(e.target.value)} />
            <label>
              <input type="checkbox" checked={docUnreadOnly} onChange={(e) => setDocUnreadOnly(e.target.checked)} />
              Apenas nao lidos
            </label>
          </div>
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{doc.title}</strong>
                <span>{doc.type}</span>
              </div>
              <p>Publicado em: {formatDate(doc.published_at)}</p>
              <div className="row">
                <button
                  className="secondary"
                  onClick={() => openSignedFile("documents", doc.storage_path, { type: "document", id: doc.id })}
                >
                  Baixar
                </button>
                <button className="secondary" onClick={() => markAsRead("document", doc.id)}>
                  {readDocIds.has(doc.id) ? "Lido" : "Marcar como lido"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Andamento da obra</h3>
          <p>Progresso: {data.progress?.progress_percent ?? 0}%</p>
          {(data.progress?.stages || []).map((stage, idx) => (
            <div key={`stage-${idx}`} className="card">
              <strong>{String(stage.stage || "Etapa")}</strong>
              <p>Planejado: {String(stage.planned_date || "-")}</p>
              <p>Real: {String(stage.actual_date || "-")}</p>
              <p>Notas: {String(stage.notes || "-")}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Galeria de fotos</h3>
          {data.galleries.map((gallery) => (
            <div key={gallery.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{gallery.month_ref}</strong>
                <span>Publicacao: {formatDate(gallery.publication_at)}</span>
              </div>
              <p>{gallery.title}</p>
              <p>{gallery.description || ""}</p>
              <button className="secondary" onClick={() => openGalleryMonth(gallery.id)}>
                Abrir galeria do mes
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderAtendimento() {
    return (
      <section className="list">
        <div className="card">
          <h3>Perguntas frequentes</h3>
          <input value={faqQuery} onChange={(e) => setFaqQuery(e.target.value)} placeholder="Pesquisar FAQ" />
          {filteredFaq.map((item) => (
            <div key={item.id} className="card">
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
              <small>{item.category}</small>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Fale Conosco (ticket)</h3>
          <input value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Assunto" />
          <input value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value)} placeholder="Categoria" />
          <textarea value={ticketMessage} onChange={(e) => setTicketMessage(e.target.value)} placeholder="Mensagem" />
          <input type="file" multiple onChange={(e) => setTicketFiles(Array.from(e.target.files || []))} />
          <button className="primary" onClick={submitTicket}>Abrir ticket</button>

          <h4>Tickets</h4>
          {data.tickets.map((ticket) => (
            <div key={ticket.id} className="card">
              <strong>{ticket.protocol}</strong>
              <p>{ticket.subject}</p>
              <p>Status: {ticket.status}</p>
              <small>{formatDateTime(ticket.updated_at)}</small>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Chat</h3>
          <div className="chat-box">
            {messages.map((msg) => (
              <div key={msg.id} className={`msg ${msg.sender_type === "client" ? "self" : ""}`}>
                <div>
                  <strong>{msg.sender_type === "client" ? "Voce" : "Atendimento"}</strong> - {formatDateTime(msg.created_at)}
                </div>
                <div>{msg.body_text || "[anexo]"}</div>
                {msg.sender_type === "client" ? (
                  <small>{msg.read_at_agent ? "Lida pelo atendimento" : "Enviada"}</small>
                ) : null}
              </div>
            ))}
          </div>
          <textarea value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Digite sua mensagem" />
          <input type="file" onChange={(e) => setChatFile(e.target.files?.[0] || null)} />
          <button className="primary" onClick={sendChatMessage}>Enviar</button>
        </div>
      </section>
    );
  }

  function renderPesquisa() {
    const groups = searchResult?.groups || {};
    return (
      <section className="list">
        <div className="card row">
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Buscar no portal" />
          <button className="primary" onClick={submitGlobalSearch}>Pesquisar</button>
        </div>
        <div className="card">
          <p>Total: {searchResult?.total || 0}</p>
          {Object.entries(groups).map(([key, items]) => (
            <div key={key} className="card">
              <h4>{key}</h4>
              {items.map((item) => (
                <div key={`${item.type}-${item.id}`} className="row" style={{ justifyContent: "space-between" }}>
                  <span>
                    <strong>{item.title}</strong> - {item.snippet}
                  </span>
                  <button
                    className="secondary"
                    onClick={() => {
                      if (item.link_target.includes("finance")) setMenu("Financeiro");
                      else if (item.link_target.includes("inform")) setMenu("Informacoes");
                      else if (item.link_target.includes("atendimento")) setMenu("Atendimento");
                      else setMenu("Novidades");
                    }}
                  >
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderDadosCadastrais() {
    return (
      <section className="list">
        <div className="card">
          <h3>Dados cadastrais</h3>
          <p>Nome: {profile?.full_name}</p>
          <p>CPF: {profile?.cpf}</p>
          <p>Telefone: {profile?.phone_e164}</p>
          <p>Email: {profile?.email_contact || "-"}</p>
          <p>Endereco: {profile?.address_line || "-"}</p>
        </div>
        <div className="card">
          <h3>Solicitar alteracao</h3>
          <textarea value={proposedChanges} onChange={(e) => setProposedChanges(e.target.value)} placeholder="Descreva os dados que deseja alterar" />
          <button className="primary" onClick={submitCadastroChangeTicket}>Solicitar alteracao</button>
        </div>
      </section>
    );
  }

  function renderMeuPerfil() {
    return (
      <section className="list">
        <div className="card">
          <h3>Preferencias</h3>
          <label>
            <input
              type="checkbox"
              checked={settings?.email_notifications || false}
              onChange={(e) =>
                settings &&
                saveSettings({
                  ...settings,
                  email_notifications: e.target.checked,
                })
              }
            />
            Notificacao por email
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings?.whatsapp_notifications || false}
              onChange={(e) =>
                settings &&
                saveSettings({
                  ...settings,
                  whatsapp_notifications: e.target.checked,
                })
              }
            />
            Notificacao por WhatsApp
          </label>
        </div>

        <div className="card">
          <h3>Contrato atual</h3>
          <p>{currentContract?.contract_number || "-"}</p>
          <select value={selectedContract} onChange={(e) => chooseContract(e.target.value)}>
            {contracts.map((contract) => (
              <option key={contract.contract_number} value={contract.contract_number}>
                {contract.contract_number} - {contract.development_name} - {contract.unit_label}
              </option>
            ))}
          </select>
        </div>
      </section>
    );
  }

  function renderContent() {
    if (menu === "Pagina Inicial") return renderDashboard();
    if (menu === "Novidades") return renderNovidades();
    if (menu === "Financeiro") return renderFinanceiro();
    if (menu === "Informacoes") return renderInformacoes();
    if (menu === "Atendimento") return renderAtendimento();
    if (menu === "Pesquisa") return renderPesquisa();
    if (menu === "Dados Cadastrais") return renderDadosCadastrais();
    if (menu === "Meu Perfil") return renderMeuPerfil();
    return null;
  }

  if (loadingSession) {
    return <div className="auth-wrap">Carregando sessao...</div>;
  }

  if (!profile) {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={handleLogin}>
          <img className="brand-logo" src={logoUrl} alt="CRM DIAMANTE" />
          <p className="brand-name">CRM DIAMANTE</p>
          <h2>Portal do Cliente</h2>
          <p>Entre com CPF e os ultimos 6 digitos do telefone cadastrado.</p>
          <label>CPF</label>
          <input
            value={loginCpf}
            onChange={(e) => setLoginCpf(formatCpfMask(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
          <label>Senha (6 digitos)</label>
          <input
            value={loginPass6}
            onChange={(e) => setLoginPass6(normalizePass6(e.target.value))}
            placeholder="123456"
            maxLength={6}
            inputMode="numeric"
          />
          {lockUntil ? (
            <p>
              Conta bloqueada ate {formatDateTime(lockUntil)}. Tempo restante: {lockRemainingSeconds}s.
            </p>
          ) : null}
          {authError ? <p>{authError}</p> : null}
          <button className="primary" type="submit">Entrar</button>
        </form>
      </div>
    );
  }

  if (mustSelectContract || (!selectedContract && contracts.length > 1)) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <img className="brand-logo" src={logoUrl} alt="CRM DIAMANTE" />
          <p className="brand-name">CRM DIAMANTE</p>
          <h2>Selecione seu contrato</h2>
          <p>Escolha o contrato para acessar o portal.</p>
          {contracts.map((contract) => (
            <button key={contract.contract_number} className="secondary" onClick={() => chooseContract(contract.contract_number)}>
              {contract.contract_number} - {contract.development_name} - {contract.unit_label}
            </button>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="secondary" onClick={handleLogout}>Voltar para login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-logo" src={logoUrl} alt="CRM DIAMANTE" />
          <div>
            <h2>Portal do Cliente</h2>
            <small>CRM DIAMANTE</small>
          </div>
        </div>
        {PORTAL_MENU.map((item) => (
          <button
            key={item}
            className={`menu-btn ${menu === item ? "active" : ""}`}
            onClick={() => {
              if (item === "Sair") {
                handleLogout();
                return;
              }
              setMenu(item);
            }}
          >
            {MENU_LABELS[item]}
          </button>
        ))}
      </aside>

      <main className="content">
        <div className="header">
          <div>
            <strong>
              Contrato: {currentContract?.contract_number || "-"}
            </strong>
            <div>
              {currentContract?.development_name || "-"} / {currentContract?.unit_label || "-"}
            </div>
          </div>
          <div>
            <strong>Bem-vindo, {profile.full_name}</strong>
          </div>
        </div>

        {authError ? <div className="card">{authError}</div> : null}
        {renderContent()}
      </main>

      {galleryModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setGalleryModalOpen(false)}
        >
          <div className="card" style={{ width: "min(90vw, 900px)" }} onClick={(e) => e.stopPropagation()}>
            <h3>Galeria</h3>
            <img src={galleryImages[galleryIndex]?.url} alt="Galeria" style={{ width: "100%", maxHeight: "70vh", objectFit: "contain" }} />
            <p>{galleryImages[galleryIndex]?.caption || ""}</p>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button
                className="secondary"
                onClick={() => setGalleryIndex((i) => Math.max(0, i - 1))}
                disabled={galleryIndex === 0}
              >
                Anterior
              </button>
              <button
                className="secondary"
                onClick={() => setGalleryIndex((i) => Math.min(galleryImages.length - 1, i + 1))}
                disabled={galleryIndex >= galleryImages.length - 1}
              >
                Proxima
              </button>
              <button className="secondary" onClick={() => setGalleryModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
