import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeId } from "@/lib/safeId";
import { useAgency } from "./AgencyContext";
import { isOnlineRuntime } from "@/lib/runtime";
import {
  AppRole,
  getRoleLabel,
  normalizeRole,
  toLegacyDbRole,
} from "@/lib/accessControl";


const mockUsers = [
  { email: 'ceo@diamante.com.br', password: 'teste123', nome: 'CEO CRM DIAMANTE', role: 'ceo' as AppRole },
  { email: 'financeiro@diamante.com.br', password: 'teste123', nome: 'Financeiro CRM DIAMANTE', role: 'financeiro' as AppRole },
  { email: 'vendas@diamante.com.br', password: 'teste123', nome: 'Vendas CRM DIAMANTE', role: 'vendas' as AppRole },
  { email: 'rh@diamante.com.br', password: 'teste123', nome: 'RH CRM DIAMANTE', role: 'rh' as AppRole },
  { email: 'engenharia@diamante.com.br', password: 'teste123', nome: 'Engenharia CRM DIAMANTE', role: 'engenharia' as AppRole },
  { email: 'suporte@diamante.com.br', password: 'teste123', nome: 'Suporte CRM DIAMANTE', role: 'suporte' as AppRole },
];
type LocalUserRecord = {
  id: string;
  email: string;
  password: string;
  nome: string;
  role: AppRole;
  telefone?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  creci?: string | null;
  brokerCode?: string | null;
};

type LocalSessionRecord = { userId: string; email: string; nome: string; role: AppRole };

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  cpf?: string | null;
  cargo?: string | null;
  nivel_acesso?: AppRole | string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    nome: string,
    telefone: string,
    role: AppRole,
    cpf?: string,
    cargo?: string,
    creci?: string,
    brokerCode?: string,
  ) => Promise<{ error: Error | null; userId?: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: Error | null }>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Só usa modo mock se for explicitamente habilitado. Em produção (Pages) usamos sempre Supabase,
// mesmo que as variáveis não estejam presentes em tempo de build (há fallback hardcoded no client).
const isMockAuthEnabled = () =>
  !isOnlineRuntime && import.meta.env.VITE_USE_MOCK_AUTH === "true";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { currentAgency, isIsolated } = useAgency();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const localUsersKey = useMemo(() => `crm_${currentAgency.id}_users`, [currentAgency.id]);
  const localSessionKey = useMemo(() => `crm_${currentAgency.id}_session`, [currentAgency.id]);

  const loadLocalUsers = (): LocalUserRecord[] => {
    try {
      const raw = localStorage.getItem(localUsersKey);
      return raw ? (JSON.parse(raw) as LocalUserRecord[]) : [];
    } catch {
      return [];
    }
  };

  const persistLocalUsers = (users: LocalUserRecord[]) => {
    try {
      localStorage.setItem(localUsersKey, JSON.stringify(users));
    } catch {
      /* ignore storage failure */
    }
  };

  const ensureDefaultMockUsers = () => {
    if (!isIsolated) return;
    const users = loadLocalUsers();
    const defaultUsers: Array<{
      email: string;
      nome: string;
      role: AppRole;
      cargo: string;
    }> = [
      {
        email: "ceo@diamante.com.br",
        nome: "CEO CRM DIAMANTE",
        role: "ceo",
        cargo: "CEO",
      },
      {
        email: "financeiro@diamante.com.br",
        nome: "Financeiro CRM DIAMANTE",
        role: "financeiro",
        cargo: "Financeiro",
      },
      {
        email: "vendas@diamante.com.br",
        nome: "Vendas CRM DIAMANTE",
        role: "vendas",
        cargo: "Vendas",
      },
      {
        email: "rh@diamante.com.br",
        nome: "RH CRM DIAMANTE",
        role: "rh",
        cargo: "RH",
      },
      {
        email: "engenharia@diamante.com.br",
        nome: "Engenharia CRM DIAMANTE",
        role: "engenharia",
        cargo: "Engenharia",
      },
      {
        email: "suporte@diamante.com.br",
        nome: "Suporte CRM DIAMANTE",
        role: "suporte",
        cargo: "Suporte",
      },
    ];

    const nextUsers = [...users];
    defaultUsers.forEach((seed) => {
      const existingIndex = nextUsers.findIndex(
        (u) => u.email.toLowerCase() === seed.email.toLowerCase(),
      );
      if (existingIndex >= 0) {
        nextUsers[existingIndex] = {
          ...nextUsers[existingIndex],
          nome: seed.nome,
          role: seed.role,
          cargo: seed.cargo,
          // Mantemos senha padrão consistente para evitar credenciais quebradas no modo mock.
          password: "teste123",
        };
      } else {
        nextUsers.push({
          id: safeId("user"),
          email: seed.email,
          password: "teste123",
          nome: seed.nome,
          role: seed.role,
          cpf: null,
          cargo: seed.cargo,
        });
      }
    });

    persistLocalUsers(nextUsers);
  };

  const loadLocalSession = (): LocalSessionRecord | null => {
    try {
      const raw = localStorage.getItem(localSessionKey);
      return raw ? (JSON.parse(raw) as LocalSessionRecord) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (isIsolated) {
      ensureDefaultMockUsers();
      const stored = loadLocalSession();
      if (stored) {
        const localUser = { id: stored.userId, email: stored.email, user_metadata: { name: stored.nome } } as unknown as User;
        setUser(localUser);
        setSession(null);
        setProfile({
          id: stored.userId,
          user_id: stored.userId,
          nome: stored.nome,
          telefone: null,
          cpf: null,
          cargo: getRoleLabel(stored.role),
          nivel_acesso: stored.role,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setRole(normalizeRole(stored.role) ?? "suporte");
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetching with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIsolated, currentAgency.id]);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) throw roleError;
      const roleFromProfile = normalizeRole(profileData?.nivel_acesso);
      const roleFromUserRoles = normalizeRole(roleData?.role);
      setRole(roleFromProfile ?? roleFromUserRoles ?? "suporte");
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      if (isIsolated) {
        const users = loadLocalUsers();
        const found = users.find((u) => u.email === email && u.password === password);
        if (!found) throw new Error("Credenciais inválidas para esta agência");
        const normalizedRole = normalizeRole(found.role) ?? "suporte";
        const localUser = { id: found.id || safeId("user"), email: found.email, user_metadata: { name: found.nome } } as unknown as User;
        setUser(localUser);
        setSession(null);
        setProfile({
          id: localUser.id,
          user_id: localUser.id,
          nome: found.nome,
          telefone: found.telefone || null,
          cpf: found.cpf || null,
          cargo: found.cargo || null,
          nivel_acesso: normalizedRole,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setRole(normalizedRole);
        try {
          localStorage.setItem(
            localSessionKey,
            JSON.stringify({ userId: localUser.id, email: found.email, nome: found.nome, role: normalizedRole })
          );
        } catch {
          /* ignore */
        }
        setLoading(false);
        return { error: null };
      }

      if (isMockAuthEnabled()) {
        const found = mockUsers.find((u) => u.email === email && u.password === password);
        if (!found) throw new Error("Credenciais inválidas");
        const mockUser = { id: safeId("user"), email: found.email, user_metadata: { name: found.nome } } as unknown as User;
        setUser(mockUser);
        setSession(null);
        setProfile({
          id: mockUser.id,
          user_id: mockUser.id,
          nome: found.nome,
          telefone: null,
          cargo: getRoleLabel(found.role),
          nivel_acesso: found.role,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setRole(found.role);
        setLoading(false);
        return { error: null };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    nome: string,
    telefone: string,
    role: AppRole,
    cpf?: string,
    cargo?: string,
    creci?: string,
    brokerCode?: string,
  ) => {
    try {
      if (isIsolated) {
        const users = loadLocalUsers();
        if (users.some((u) => u.email === email)) throw new Error("E-mail já cadastrado para esta agência");
        const localUser = {
          id: safeId("user"),
          email,
          password,
          nome,
          telefone: telefone || null,
          cpf: cpf || null,
          cargo: cargo || null,
          creci: creci || null,
          brokerCode: brokerCode || null,
          role,
        };
        persistLocalUsers([...users, localUser]);
        // Auto-login apenas se não houver usuário ativo (ex: criação pela tela de login)
        if (!user) {
          setUser({ id: localUser.id, email: localUser.email } as unknown as User);
          setProfile({
            id: localUser.id,
            user_id: localUser.id,
            nome: localUser.nome,
            telefone: localUser.telefone,
            cpf: localUser.cpf,
            cargo: localUser.cargo,
            nivel_acesso: localUser.role,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setRole(localUser.role);
          try {
            localStorage.setItem(
              localSessionKey,
              JSON.stringify({ userId: localUser.id, email: localUser.email, nome: localUser.nome, role: localUser.role })
            );
          } catch {
            /* ignore */
          }
        }
        return { error: null, userId: localUser.id };
      }

      if (isMockAuthEnabled()) {
        mockUsers.push({ email, password, nome, role });
        setRole(role);
        setProfile({ id: safeId("user"), user_id: "mock", nome, telefone: telefone || null, cpf: cpf || null, cargo: cargo || null, nivel_acesso: role, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return { error: null, userId: "mock" };
      }
      const redirectUrl = `${window.location.origin}/`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: authData.user.id,
        nome,
        telefone: telefone || null,
        cpf: cpf || null,
        cargo: cargo || null,
        nivel_acesso: role,
      });

      if (profileError) throw profileError;

      // Create user role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: toLegacyDbRole(role),
      });

      if (roleError) throw roleError;

      // Log access (only if caller is manager; ignore errors silently)
      if (user?.id) {
        await supabase.from("acessos").insert({
          user_id: authData.user.id,
          created_by: user.id,
          cpf: cpf || null,
          cargo: cargo || null,
          role,
        });
      }

      return { error: null, userId: authData.user.id };
    } catch (error) {
      return { error: error as Error, userId: null };
    }
  };

  const signOut = async () => {
    if (isIsolated) {
      try {
        localStorage.removeItem(localSessionKey);
      } catch {
        /* ignore */
      }
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    try {
      if (isIsolated) {
        setProfile((prev) => (prev ? { ...prev, ...data } : prev));
        return { error: null };
      }

      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setProfile((prev) => (prev ? { ...prev, ...data } : null));
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const uploadAvatar = async (file: File) => {
    try {
      // Mock mode: apenas salva localmente em memória
      if (isIsolated || isMockAuthEnabled()) {
        const url = URL.createObjectURL(file);
        setProfile((prev) =>
          prev
            ? { ...prev, avatar_url: url }
            : {
                id: safeId("user"),
                user_id: "mock",
                nome: prev?.nome || "Usuário Mock",
                telefone: prev?.telefone || null,
                cpf: prev?.cpf || null,
                cargo: prev?.cargo || null,
                nivel_acesso: prev?.nivel_acesso || role || "colaborador",
                avatar_url: url,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
        );
        return { url, error: null };
      }

      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: avatarUrl });

      return { url: avatarUrl, error: null };
    } catch (error) {
      return { url: null, error: error as Error };
    }
  };

  const value = {
    user,
    session,
    profile,
    role,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    uploadAvatar,
    isAdmin: role === "admin" || role === "ceo",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
