import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


const mockUsers = [
  { email: 'ceo@clabs.ag', password: 'teste123', nome: 'CEO C.LABS', role: 'ceo' as AppRole },
  { email: 'colab@clabs.ag', password: 'teste123', nome: 'Colaborador C.LABS', role: 'colaborador' as AppRole },
];

type AppRole = "admin" | "colaborador" | "ceo";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  cpf?: string | null;
  cargo?: string | null;
  nivel_acesso?: AppRole | null;
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
  signUp: (email: string, password: string, nome: string, telefone: string, role: AppRole, cpf?: string, cargo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: Error | null }>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Só usa modo mock se for explicitamente habilitado. Em produção (Pages) usamos sempre Supabase,
// mesmo que as variáveis não estejam presentes em tempo de build (há fallback hardcoded no client).
const useMockAuth = () => import.meta.env.VITE_USE_MOCK_AUTH === "true";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>("ceo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
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

    // THEN check for existing session
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
  }, []);

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
      setRole(roleData?.role ?? null);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      if (useMockAuth()) {
        const found = mockUsers.find((u) => u.email === email && u.password === password);
        if (!found) throw new Error("Credenciais inválidas");
        const mockUser: any = { id: crypto.randomUUID(), email: found.email, user_metadata: { name: found.nome } };
        setUser(mockUser);
        setSession(null);
        setProfile({ id: mockUser.id, user_id: mockUser.id, nome: found.nome, telefone: null, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
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

  const signUp = async (email: string, password: string, nome: string, telefone: string, role: AppRole, cpf?: string, cargo?: string) => {
    try {
      if (useMockAuth()) {
        mockUsers.push({ email, password, nome, role, 
          });
        setRole(role);
        setProfile({ id: crypto.randomUUID(), user_id: "mock", nome, telefone: telefone || null, cpf: cpf || null, cargo: cargo || null, nivel_acesso: role, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return { error: null };
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
        role,
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

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    try {
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
      if (useMockAuth()) {
        const url = URL.createObjectURL(file);
        setProfile((prev) =>
          prev
            ? { ...prev, avatar_url: url }
            : {
                id: crypto.randomUUID(),
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
