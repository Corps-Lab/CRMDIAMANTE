-- Domain schema update for CRM DIAMANTE
-- Adds CEO/manager support, profile metadata, and core app tables

-- Helper to check manager (admin or ceo)
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'ceo')
  );
$$;

-- Strengthen access control helpers to recognize managers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id != auth.uid() AND NOT public.is_manager(auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id != auth.uid() AND NOT public.is_manager(auth.uid()) THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
  );
END;
$$;

-- 2) Enrich profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cargo TEXT,
  ADD COLUMN IF NOT EXISTS nivel_acesso app_role DEFAULT 'colaborador';

-- Policies: ensure CEO also has elevated access
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_manager(auth.uid()));

-- 3) Update role policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert colaborador role for themselves" ON public.user_roles;

CREATE POLICY "Managers can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_manager(auth.uid()));

CREATE POLICY "Users can insert colaborador role for themselves"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'colaborador'::app_role
  );

-- 4) Core data tables ---------------------------------------------------

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  cnpj text NOT NULL UNIQUE,
  endereco text,
  valor_pago numeric(12,2) NOT NULL DEFAULT 0,
  recorrencia text NOT NULL CHECK (recorrencia IN ('mensal','trimestral','semestral','anual')),
  responsavel text,
  contato_interno text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage clients"
  ON public.clients FOR ALL
  USING (public.is_manager(auth.uid()));

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Demands (Pedidos) e tarefas
CREATE TABLE IF NOT EXISTS public.demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  demanda text NOT NULL,
  descricao text,
  data_pedido date NOT NULL,
  data_entrega date NOT NULL,
  responsavel text,
  status text NOT NULL CHECK (status IN ('pendente','em_andamento','concluida','atrasada')),
  prioridade text NOT NULL CHECK (prioridade IN ('baixa','media','alta','urgente')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demand_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  concluida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demands"
  ON public.demands FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage demands"
  ON public.demands FOR ALL
  USING (public.is_manager(auth.uid()));

CREATE POLICY "Authenticated users can read demand tasks"
  ON public.demand_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage demand tasks"
  ON public.demand_tasks FOR ALL
  USING (public.is_manager(auth.uid()));

CREATE TRIGGER update_demands_updated_at
BEFORE UPDATE ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Finanças (lançamentos)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('entrada','despesa')),
  descricao text,
  valor numeric(12,2) NOT NULL,
  categoria text,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL CHECK (ano >= 2000),
  vencimento integer CHECK (vencimento BETWEEN 1 AND 31),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can manage transactions"
  ON public.transactions FOR ALL
  USING (public.is_manager(auth.uid()));
CREATE POLICY "Authenticated users can read transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Sugestões e Reclamações
CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('sugestao','reclamacao')),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','respondido','fechado')),
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own suggestions"
  ON public.suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own suggestions"
  ON public.suggestions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Managers can read all suggestions"
  ON public.suggestions FOR SELECT
  USING (public.is_manager(auth.uid()));
CREATE POLICY "Managers can manage suggestions"
  ON public.suggestions FOR ALL
  USING (public.is_manager(auth.uid()));

-- Acessos (auditoria de criação de acesso)
CREATE TABLE IF NOT EXISTS public.acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cpf text,
  cargo text,
  role app_role NOT NULL DEFAULT 'colaborador',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acessos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can manage acessos"
  ON public.acessos FOR ALL
  USING (public.is_manager(auth.uid()));
CREATE POLICY "Managers can read acessos"
  ON public.acessos FOR SELECT
  USING (public.is_manager(auth.uid()));

-- Convenience views for CEO and colaboradores
CREATE OR REPLACE VIEW public.ceos AS
SELECT
  u.id AS user_id,
  u.email,
  p.nome,
  p.cargo,
  p.cpf,
  p.avatar_url,
  p.created_at,
  p.updated_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'ceo'
LEFT JOIN public.profiles p ON p.user_id = u.id;

CREATE OR REPLACE VIEW public.colaboradores AS
SELECT
  u.id AS user_id,
  u.email,
  p.nome,
  p.cargo,
  p.cpf,
  p.avatar_url,
  p.created_at,
  p.updated_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'colaborador'
LEFT JOIN public.profiles p ON p.user_id = u.id;
