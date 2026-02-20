import { useEffect, useMemo, useState } from "react";
import type { Conversation, Message } from "@crm/shared";
import { supabase } from "./supabase";

type ConversationWithMeta = Conversation & {
  contract?: {
    development_name: string;
    unit_label: string;
  };
  client_name?: string;
  client_cpf?: string;
};

const STATUS_TABS = ["new", "open", "pending", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function sanitizePortalBase(raw: string) {
  return raw.replace(/\/+$/, "");
}

export default function App() {
  const portalBaseUrl = sanitizePortalBase(
    (import.meta.env.VITE_PORTAL_URL as string | undefined)?.trim() || "http://localhost:5174/#",
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string>("");
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("new");
  const [assignedFilter, setAssignedFilter] = useState<"all" | "me" | "unassigned">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState("");
  const [messageType, setMessageType] = useState<"text" | "note">("text");
  const [macroId, setMacroId] = useState<string>("");
  const [macros, setMacros] = useState<Array<{ id: string; title: string; body: string }>>([]);
  const [linkFeedback, setLinkFeedback] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) || null,
    [conversations, selectedId],
  );

  const portalAuthLink = useMemo(() => `${portalBaseUrl}/login`, [portalBaseUrl]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((item) => item.status === tab)
      .filter((item) => {
        if (assignedFilter === "me") return item.assigned_agent_id === agentId;
        if (assignedFilter === "unassigned") return !item.assigned_agent_id;
        return true;
      })
      .filter((item) => (priorityFilter === "all" ? true : item.priority === priorityFilter))
      .filter((item) => {
        if (!q) return true;
        const haystack = [
          item.contract_number,
          item.client_name || "",
          item.client_cpf || "",
          item.contract?.unit_label || "",
          item.contract?.development_name || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
  }, [conversations, tab, assignedFilter, priorityFilter, search, agentId]);

  async function checkSession() {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const agent = await supabase.from("agents").select("user_id").eq("user_id", uid).maybeSingle();
    if (!agent.data) {
      await supabase.auth.signOut();
      setAuthError("Usuario autenticado nao e agente.");
      setLoading(false);
      return;
    }

    setAgentId(uid);
    setLoading(false);
  }

  async function loadConversations() {
    const convRes = await supabase.from("conversations").select("*");
    const list = (convRes.data || []) as Conversation[];

    const contractNumbers = Array.from(new Set(list.map((item) => item.contract_number)));
    const userIds = Array.from(new Set(list.map((item) => item.user_id)));

    const [contractRes, profileRes] = await Promise.all([
      supabase
        .from("contracts")
        .select("contract_number,development_name,unit_label")
        .in("contract_number", contractNumbers),
      supabase.from("profiles").select("user_id,full_name,cpf").in("user_id", userIds),
    ]);

    const contractsMap = new Map(
      ((contractRes.data || []) as Array<{ contract_number: string; development_name: string; unit_label: string }>).map((item) => [
        item.contract_number,
        item,
      ]),
    );

    const profilesMap = new Map(
      ((profileRes.data || []) as Array<{ user_id: string; full_name: string; cpf: string }>).map((item) => [
        item.user_id,
        { full_name: item.full_name, cpf: item.cpf },
      ]),
    );

    const hydrated = list.map((item) => {
      const profile = profilesMap.get(item.user_id);
      return {
        ...item,
        contract: contractsMap.get(item.contract_number),
        client_name: profile?.full_name,
        client_cpf: profile?.cpf,
      };
    });

    setConversations(hydrated);
    if (!selectedId && hydrated[0]) setSelectedId(hydrated[0].id);
  }

  async function loadMessages(conversationId: string) {
    const res = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((res.data || []) as Message[]);
  }

  useEffect(() => {
    checkSession().catch((error) => {
      setAuthError(error instanceof Error ? error.message : "Falha de autenticacao");
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkSession().catch(() => {
        setLoading(false);
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!agentId) return;

    loadConversations();
    supabase
      .from("macros")
      .select("id,title,body")
      .order("created_at", { ascending: false })
      .then((res) => setMacros((res.data || []) as Array<{ id: string; title: string; body: string }>));
  }, [agentId]);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel(`agent-inbox-${agentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          loadConversations();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          if (selectedId) loadMessages(selectedId);
          loadConversations();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          loadConversations();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, selectedId]);

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");

    const login = await supabase.auth.signInWithPassword({ email, password });
    if (login.error) {
      setAuthError(login.error.message);
      return;
    }

    await checkSession();
    setEmail("");
    setPassword("");
  }

  async function onLogout() {
    await supabase.auth.signOut();
    setAgentId("");
    setConversations([]);
    setSelectedId("");
    setMessages([]);
  }

  async function onAssignToMe() {
    if (!selectedConversation || !agentId) return;
    await supabase
      .from("conversations")
      .update({ assigned_agent_id: agentId, status: "open" })
      .eq("id", selectedConversation.id);
  }

  async function onUpdateStatus(status: string) {
    if (!selectedConversation) return;
    await supabase.from("conversations").update({ status }).eq("id", selectedConversation.id);
  }

  async function onUpdatePriority(priority: string) {
    if (!selectedConversation) return;
    await supabase.from("conversations").update({ priority }).eq("id", selectedConversation.id);
  }

  async function onSendMessage() {
    if (!selectedConversation || !agentId || !composer.trim()) return;

    await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      contract_number: selectedConversation.contract_number,
      sender_type: "agent",
      sender_user_id: agentId,
      message_type: messageType,
      body_text: composer,
    });

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "open",
      })
      .eq("id", selectedConversation.id);

    setComposer("");
    setMessageType("text");
    loadMessages(selectedConversation.id);
    loadConversations();
  }

  async function copyText(value: string, okMessage: string) {
    await navigator.clipboard.writeText(value);
    setLinkFeedback(okMessage);
    window.setTimeout(() => setLinkFeedback(""), 2500);
  }

  async function onCopyPortalLink() {
    try {
      await copyText(portalAuthLink, "Link de autenticacao copiado.");
    } catch (_error) {
      setLinkFeedback("Nao foi possivel copiar o link.");
      window.setTimeout(() => setLinkFeedback(""), 2500);
    }
  }

  async function onCopyPortalMessage() {
    const message =
      "Ola!\nSegue o acesso ao Portal do Cliente:\n" +
      `${portalAuthLink}\n` +
      "Acesse com CPF e os ultimos 6 digitos do telefone cadastrado.";
    try {
      await copyText(message, "Mensagem pronta copiada.");
    } catch (_error) {
      setLinkFeedback("Nao foi possivel copiar a mensagem.");
      window.setTimeout(() => setLinkFeedback(""), 2500);
    }
  }

  function applyMacro() {
    if (!macroId) return;
    const selected = macros.find((item) => item.id === macroId);
    if (!selected) return;
    setComposer(selected.body);
  }

  if (loading) {
    return <div className="app">Carregando...</div>;
  }

  if (!agentId) {
    return (
      <div className="app">
        <form className="auth-card" onSubmit={onLogin}>
          <h2>CRM DIAMANTE</h2>
          <p>Login do time interno (CRM principal).</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@crm.com" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha"
            type="password"
          />
          {authError ? <p>{authError}</p> : null}
          <button className="primary" type="submit">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <h2>CRM DIAMANTE (Principal)</h2>
        <button onClick={onLogout}>Sair</button>
      </div>

      <div className="card">
        <h3>Portal do Cliente (app dentro do CRM)</h3>
        <p>
          Este modulo apenas gera o link de autenticacao para voce enviar ao cliente.
        </p>
        <input value={portalAuthLink} readOnly />
        <div className="row">
          <button className="secondary" onClick={onCopyPortalLink}>Copiar link</button>
          <button className="secondary" onClick={onCopyPortalMessage}>Copiar mensagem pronta</button>
          <button
            className="secondary"
            onClick={() => window.open(portalAuthLink, "_blank", "noopener,noreferrer")}
          >
            Ir para autenticacao do portal
          </button>
        </div>
        {linkFeedback ? <small>{linkFeedback}</small> : null}
      </div>

      <div className="card row">
        <div>
          <label>Status</label>
          <div className="row">
            {STATUS_TABS.map((status) => (
              <button key={status} className={tab === status ? "primary" : ""} onClick={() => setTab(status)}>
                {status}
              </button>
            ))}
          </div>
        </div>

        <div style={{ minWidth: 180 }}>
          <label>Atribuicao</label>
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value as "all" | "me" | "unassigned")}>
            <option value="all">all</option>
            <option value="me">me</option>
            <option value="unassigned">unassigned</option>
          </select>
        </div>

        <div style={{ minWidth: 180 }}>
          <label>Prioridade</label>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">all</option>
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <label>Busca</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="contract/client/cpf/unit/development"
          />
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <h3>Conversas</h3>
          <div className="inbox-list">
            {filteredConversations.map((item) => (
              <button
                key={item.id}
                className="conv-item"
                onClick={() => setSelectedId(item.id)}
                style={{ textAlign: "left" }}
              >
                <div>
                  <strong>{item.contract_number}</strong> • {item.client_name || "Cliente"}
                </div>
                <div>CPF: {item.client_cpf || "-"}</div>
                <div>
                  {item.contract?.development_name} / {item.contract?.unit_label}
                </div>
                <div>
                  {item.status} • {item.priority} • {item.assigned_agent_id ? "assigned" : "unassigned"}
                </div>
                <small>{new Date(item.last_message_at).toLocaleString()}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          {!selectedConversation ? (
            <p>Selecione uma conversa.</p>
          ) : (
            <>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>
                  {selectedConversation.contract_number} • {selectedConversation.client_name}
                </h3>
                <button onClick={onAssignToMe}>Assign to me</button>
              </div>

              <div className="row">
                <div style={{ minWidth: 180 }}>
                  <label>Status</label>
                  <select
                    value={selectedConversation.status}
                    onChange={(e) => onUpdateStatus(e.target.value)}
                  >
                    {STATUS_TABS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 180 }}>
                  <label>Prioridade</label>
                  <select
                    value={selectedConversation.priority}
                    onChange={(e) => onUpdatePriority(e.target.value)}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="messages">
                {messages.map((msg) => (
                  <div key={msg.id} className={`msg ${msg.message_type === "note" ? "note" : ""}`}>
                    <div>
                      <strong>{msg.sender_type}</strong> • {msg.message_type} • {new Date(msg.created_at).toLocaleString()}
                    </div>
                    <div>{msg.body_text || "[attachment/system]"}</div>
                  </div>
                ))}
              </div>

              <div className="row">
                <div style={{ minWidth: 220 }}>
                  <label>Macros</label>
                  <select value={macroId} onChange={(e) => setMacroId(e.target.value)}>
                    <option value="">Selecione macro</option>
                    {macros.map((macro) => (
                      <option key={macro.id} value={macro.id}>
                        {macro.title}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={applyMacro}>Aplicar macro</button>
              </div>

              <div className="row">
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as "text" | "note")}
                  style={{ maxWidth: 180 }}
                >
                  <option value="text">text</option>
                  <option value="note">note (interna)</option>
                </select>
              </div>

              <textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Escreva a resposta" />
              <button className="primary" onClick={onSendMessage}>
                Enviar
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
