-- CRM DIAMANTE hardening:
-- 1) Persistencia real de corretores/comissao/vendas
-- 2) RLS por perfil
-- 3) Integracao de comunicar venda com contrato + financeiro

-- Expand app_role enum for all CRM profiles used by the app
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'financeiro'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'financeiro';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'vendas'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'vendas';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'rh'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'rh';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'engenharia'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'engenharia';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'suporte'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'suporte';
  END IF;
END;
$$;

-- Role helpers based on profiles.nivel_acesso (fallback user_roles)
CREATE OR REPLACE FUNCTION public.current_profile_role(_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(
    COALESCE(
      (SELECT p.nivel_acesso::text FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1),
      (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = _user_id LIMIT 1),
      'colaborador'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access(_permission text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  _role := public.current_profile_role(_user_id);

  IF _role IN ('ceo', 'admin') THEN
    RETURN true;
  END IF;

  IF _permission IN ('sugestoes', 'suporte', 'perfil') THEN
    RETURN true;
  END IF;

  CASE _role
    WHEN 'financeiro' THEN
      RETURN _permission IN ('dashboard', 'clientes', 'fornecedores', 'funil', 'simulador', 'importar', 'contratos', 'financeiro');
    WHEN 'vendas' THEN
      RETURN _permission IN ('clientes', 'funil', 'simulador', 'importar', 'contratos', 'tarefas');
    WHEN 'rh' THEN
      RETURN _permission IN ('importar', 'contratos', 'tarefas');
    WHEN 'engenharia' THEN
      RETURN _permission IN ('clientes', 'fornecedores', 'obras', 'assistencia', 'rdo', 'rfis', 'vistorias', 'importar', 'contratos', 'tarefas');
    WHEN 'suporte' THEN
      RETURN _permission IN ('tarefas');
    WHEN 'colaborador' THEN
      RETURN _permission IN ('tarefas');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_commission(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_profile_role(_user_id) IN ('ceo', 'financeiro', 'admin');
$$;

-- Contracts table persisted in database
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name_snapshot text NOT NULL,
  titulo text NOT NULL,
  valor_contrato numeric(14,2) NOT NULL DEFAULT 0,
  recorrencia text NOT NULL CHECK (recorrencia IN ('unico','mensal','trimestral','semestral','anual')),
  data_inicio date NOT NULL,
  data_fim date,
  status text NOT NULL CHECK (status IN ('ativo','pendente','encerrado','cancelado')),
  conteudo text NOT NULL,
  sale_communication_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_sale ON public.contracts(sale_communication_id);
CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contracts read by contracts permission"
  ON public.contracts FOR SELECT
  USING (public.can_access('contratos', auth.uid()));
CREATE POLICY "Contracts manage by contracts permission"
  ON public.contracts FOR ALL
  USING (public.can_access('contratos', auth.uid()))
  WITH CHECK (public.can_access('contratos', auth.uid()));

-- Broker registry (codigo unico corretor)
CREATE TABLE IF NOT EXISTS public.broker_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL DEFAULT 'diamante',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text NOT NULL,
  cpf text NOT NULL,
  creci text,
  broker_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, broker_code),
  UNIQUE (agency_id, cpf)
);
CREATE INDEX IF NOT EXISTS idx_broker_registry_user ON public.broker_registry(user_id);
CREATE TRIGGER update_broker_registry_updated_at
BEFORE UPDATE ON public.broker_registry
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.broker_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Broker registry read by funil"
  ON public.broker_registry FOR SELECT
  USING (public.can_access('funil', auth.uid()) OR public.can_access('acessos', auth.uid()));
CREATE POLICY "Broker registry manage by acessos"
  ON public.broker_registry FOR ALL
  USING (public.can_access('acessos', auth.uid()) OR public.can_manage_commission(auth.uid()))
  WITH CHECK (public.can_access('acessos', auth.uid()) OR public.can_manage_commission(auth.uid()));

-- Commission settings by agency
CREATE TABLE IF NOT EXISTS public.sales_commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL UNIQUE DEFAULT 'diamante',
  percentual numeric(5,2) NOT NULL DEFAULT 5,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (percentual >= 0 AND percentual <= 100)
);

ALTER TABLE public.sales_commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commission read by funil"
  ON public.sales_commission_settings FOR SELECT
  USING (public.can_access('funil', auth.uid()));
CREATE POLICY "Commission manage by ceo financeiro"
  ON public.sales_commission_settings FOR ALL
  USING (public.can_manage_commission(auth.uid()))
  WITH CHECK (public.can_manage_commission(auth.uid()));

-- Sales communications
CREATE TABLE IF NOT EXISTS public.sales_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL DEFAULT 'diamante',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_nome_cliente text NOT NULL,
  unidade text,
  valor_venda numeric(14,2) NOT NULL,
  percentual_comissao numeric(5,2) NOT NULL,
  valor_comissao numeric(14,2) NOT NULL,
  broker_nome text NOT NULL,
  broker_cpf text NOT NULL,
  broker_creci text,
  broker_code text NOT NULL,
  registrado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_communications_lead ON public.sales_communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_communications_created ON public.sales_communications(created_at DESC);

ALTER TABLE public.sales_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales communications read by funil"
  ON public.sales_communications FOR SELECT
  USING (public.can_access('funil', auth.uid()) OR public.can_access('financeiro', auth.uid()));
CREATE POLICY "Sales communications insert by funil"
  ON public.sales_communications FOR INSERT
  WITH CHECK (public.can_access('funil', auth.uid()));
CREATE POLICY "Sales communications update by managers"
  ON public.sales_communications FOR UPDATE
  USING (public.can_manage_commission(auth.uid()) OR public.can_access('funil', auth.uid()))
  WITH CHECK (public.can_manage_commission(auth.uid()) OR public.can_access('funil', auth.uid()));
CREATE POLICY "Sales communications delete by managers"
  ON public.sales_communications FOR DELETE
  USING (public.can_manage_commission(auth.uid()));

-- Audit trail table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id text,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entidade, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit logs insert authenticated"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Audit logs read by management"
  ON public.audit_logs FOR SELECT
  USING (public.can_manage_commission(auth.uid()) OR public.can_access('acessos', auth.uid()));

-- Add origin tracking to transactions for automatic sale postings
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_sale_id uuid REFERENCES public.sales_communications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_type text;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_origin_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_origin_type_check
  CHECK (origin_type IS NULL OR origin_type IN ('manual', 'venda', 'comissao', 'outro'));

CREATE INDEX IF NOT EXISTS idx_transactions_origin_sale ON public.transactions(origin_sale_id);

-- Tighten existing policies to role-permission model
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can manage clients" ON public.clients;
CREATE POLICY "Clients read by role"
  ON public.clients FOR SELECT
  USING (public.can_access('clientes', auth.uid()));
CREATE POLICY "Clients manage by role"
  ON public.clients FOR ALL
  USING (public.can_access('clientes', auth.uid()))
  WITH CHECK (public.can_access('clientes', auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Managers can manage suppliers" ON public.suppliers;
CREATE POLICY "Suppliers read by role"
  ON public.suppliers FOR SELECT
  USING (public.can_access('fornecedores', auth.uid()));
CREATE POLICY "Suppliers manage by role"
  ON public.suppliers FOR ALL
  USING (public.can_access('fornecedores', auth.uid()))
  WITH CHECK (public.can_access('fornecedores', auth.uid()));

DROP POLICY IF EXISTS "Leads read" ON public.leads;
DROP POLICY IF EXISTS "Leads manage" ON public.leads;
CREATE POLICY "Leads read by role"
  ON public.leads FOR SELECT
  USING (public.can_access('funil', auth.uid()));
CREATE POLICY "Leads manage by role"
  ON public.leads FOR ALL
  USING (public.can_access('funil', auth.uid()))
  WITH CHECK (public.can_access('funil', auth.uid()));

DROP POLICY IF EXISTS "Authenticated can manage demands" ON public.demands;
DROP POLICY IF EXISTS "Authenticated users can read demands" ON public.demands;
DROP POLICY IF EXISTS "Managers can manage demands" ON public.demands;
CREATE POLICY "Demands read by tasks permission"
  ON public.demands FOR SELECT
  USING (public.can_access('tarefas', auth.uid()));
CREATE POLICY "Demands manage by tasks permission"
  ON public.demands FOR ALL
  USING (public.can_access('tarefas', auth.uid()))
  WITH CHECK (public.can_access('tarefas', auth.uid()));

DROP POLICY IF EXISTS "Authenticated can manage demand tasks" ON public.demand_tasks;
DROP POLICY IF EXISTS "Authenticated users can read demand tasks" ON public.demand_tasks;
DROP POLICY IF EXISTS "Managers can manage demand tasks" ON public.demand_tasks;
CREATE POLICY "Demand tasks read by tasks permission"
  ON public.demand_tasks FOR SELECT
  USING (public.can_access('tarefas', auth.uid()));
CREATE POLICY "Demand tasks manage by tasks permission"
  ON public.demand_tasks FOR ALL
  USING (public.can_access('tarefas', auth.uid()))
  WITH CHECK (public.can_access('tarefas', auth.uid()));

DROP POLICY IF EXISTS "Projects read" ON public.projects;
DROP POLICY IF EXISTS "Projects manage" ON public.projects;
CREATE POLICY "Projects read by role"
  ON public.projects FOR SELECT
  USING (public.can_access('obras', auth.uid()));
CREATE POLICY "Projects manage by role"
  ON public.projects FOR ALL
  USING (public.can_access('obras', auth.uid()))
  WITH CHECK (public.can_access('obras', auth.uid()));

DROP POLICY IF EXISTS "Units read" ON public.units;
DROP POLICY IF EXISTS "Units manage" ON public.units;
CREATE POLICY "Units read by role"
  ON public.units FOR SELECT
  USING (public.can_access('obras', auth.uid()));
CREATE POLICY "Units manage by role"
  ON public.units FOR ALL
  USING (public.can_access('obras', auth.uid()))
  WITH CHECK (public.can_access('obras', auth.uid()));

DROP POLICY IF EXISTS "RFIs read" ON public.rfis;
DROP POLICY IF EXISTS "RFIs manage" ON public.rfis;
CREATE POLICY "RFIs read by role"
  ON public.rfis FOR SELECT
  USING (public.can_access('rfis', auth.uid()));
CREATE POLICY "RFIs manage by role"
  ON public.rfis FOR ALL
  USING (public.can_access('rfis', auth.uid()))
  WITH CHECK (public.can_access('rfis', auth.uid()));

DROP POLICY IF EXISTS "RDO read" ON public.rdos;
DROP POLICY IF EXISTS "RDO manage" ON public.rdos;
CREATE POLICY "RDO read by role"
  ON public.rdos FOR SELECT
  USING (public.can_access('rdo', auth.uid()));
CREATE POLICY "RDO manage by role"
  ON public.rdos FOR ALL
  USING (public.can_access('rdo', auth.uid()))
  WITH CHECK (public.can_access('rdo', auth.uid()));

DROP POLICY IF EXISTS "Managers can manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated can manage transactions" ON public.transactions;
CREATE POLICY "Transactions read by finance and funil"
  ON public.transactions FOR SELECT
  USING (public.can_access('financeiro', auth.uid()) OR public.can_access('funil', auth.uid()));
CREATE POLICY "Transactions manage by finance"
  ON public.transactions FOR ALL
  USING (public.can_access('financeiro', auth.uid()))
  WITH CHECK (public.can_access('financeiro', auth.uid()));

-- Automatic sale communication pipeline
CREATE OR REPLACE FUNCTION public.process_sale_communication(
  _agency_id text,
  _lead_id uuid,
  _lead_nome_cliente text,
  _unidade text,
  _valor_venda numeric,
  _broker_nome text,
  _broker_cpf text,
  _broker_creci text,
  _broker_code text,
  _create_contract boolean DEFAULT true,
  _create_finance boolean DEFAULT true
)
RETURNS TABLE (
  communication_id uuid,
  contract_id uuid,
  entrada_transaction_id uuid,
  comissao_transaction_id uuid,
  percentual_comissao numeric,
  valor_comissao numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _broker public.broker_registry%ROWTYPE;
  _percentual numeric(5,2) := 5;
  _comissao numeric(14,2);
  _communication_id uuid;
  _contract_id uuid;
  _entrada_id uuid;
  _despesa_id uuid;
  _client_id uuid;
  _lead_nome text;
  _mes integer := EXTRACT(MONTH FROM now())::int;
  _ano integer := EXTRACT(YEAR FROM now())::int;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF NOT public.can_access('funil', _actor) THEN
    RAISE EXCEPTION 'Sem permissao para comunicar venda';
  END IF;

  IF COALESCE(_agency_id, '') = '' THEN
    _agency_id := 'diamante';
  END IF;

  SELECT *
    INTO _broker
  FROM public.broker_registry br
  WHERE br.agency_id = _agency_id
    AND upper(br.broker_code) = upper(trim(_broker_code))
  LIMIT 1;

  IF _broker.id IS NULL THEN
    RAISE EXCEPTION 'Codigo de corretor nao encontrado';
  END IF;

  IF regexp_replace(COALESCE(_broker.cpf, ''), '\D', '', 'g')
      <> regexp_replace(COALESCE(_broker_cpf, ''), '\D', '', 'g') THEN
    RAISE EXCEPTION 'Codigo do corretor nao corresponde ao CPF informado';
  END IF;

  IF COALESCE(_broker.creci, '') <> '' THEN
    IF upper(trim(COALESCE(_broker_creci, ''))) <> upper(trim(COALESCE(_broker.creci, ''))) THEN
      RAISE EXCEPTION 'CRECI informado nao confere com o cadastro do corretor';
    END IF;
  END IF;

  SELECT s.percentual
    INTO _percentual
  FROM public.sales_commission_settings s
  WHERE s.agency_id = _agency_id
  LIMIT 1;

  _percentual := COALESCE(_percentual, 5);
  _comissao := ROUND((_valor_venda * _percentual / 100.0)::numeric, 2);
  _lead_nome := COALESCE(NULLIF(trim(_lead_nome_cliente), ''), COALESCE(_broker_nome, 'Cliente sem nome'));

  SELECT c.id
    INTO _client_id
  FROM public.clients c
  WHERE lower(trim(c.razao_social)) = lower(trim(_lead_nome))
  LIMIT 1;

  INSERT INTO public.sales_communications (
    agency_id,
    lead_id,
    lead_nome_cliente,
    unidade,
    valor_venda,
    percentual_comissao,
    valor_comissao,
    broker_nome,
    broker_cpf,
    broker_creci,
    broker_code,
    registrado_por
  )
  VALUES (
    _agency_id,
    _lead_id,
    _lead_nome,
    _unidade,
    _valor_venda,
    _percentual,
    _comissao,
    COALESCE(NULLIF(trim(_broker_nome), ''), _broker.nome),
    regexp_replace(COALESCE(_broker_cpf, ''), '\D', '', 'g'),
    NULLIF(trim(_broker_creci), ''),
    upper(trim(_broker_code)),
    _actor
  )
  RETURNING id INTO _communication_id;

  IF _create_contract THEN
    INSERT INTO public.contracts (
      client_id,
      client_name_snapshot,
      titulo,
      valor_contrato,
      recorrencia,
      data_inicio,
      data_fim,
      status,
      conteudo,
      sale_communication_id,
      created_by
    )
    VALUES (
      _client_id,
      _lead_nome,
      'Contrato - ' || _lead_nome,
      _valor_venda,
      'unico',
      CURRENT_DATE,
      NULL,
      'pendente',
      'Contrato gerado automaticamente a partir da comunicacao de venda.',
      _communication_id,
      _actor
    )
    RETURNING id INTO _contract_id;
  END IF;

  IF _create_finance THEN
    INSERT INTO public.transactions (
      tipo,
      descricao,
      valor,
      categoria,
      mes,
      ano,
      vencimento,
      client_id,
      created_by,
      origin_sale_id,
      origin_type
    )
    VALUES (
      'entrada',
      'Venda comunicada - ' || _lead_nome,
      _valor_venda,
      'Venda',
      _mes,
      _ano,
      EXTRACT(DAY FROM now())::int,
      _client_id,
      _actor,
      _communication_id,
      'venda'
    )
    RETURNING id INTO _entrada_id;

    INSERT INTO public.transactions (
      tipo,
      descricao,
      valor,
      categoria,
      mes,
      ano,
      vencimento,
      client_id,
      created_by,
      origin_sale_id,
      origin_type
    )
    VALUES (
      'despesa',
      'Comissao corretor - ' || COALESCE(NULLIF(trim(_broker_nome), ''), _broker.nome),
      _comissao,
      'Comissao Corretor',
      _mes,
      _ano,
      EXTRACT(DAY FROM now())::int,
      NULL,
      _actor,
      _communication_id,
      'comissao'
    )
    RETURNING id INTO _despesa_id;
  END IF;

  INSERT INTO public.audit_logs (entidade, entidade_id, acao, detalhes, performed_by)
  VALUES (
    'sales_communication',
    _communication_id::text,
    'create',
    jsonb_build_object(
      'agency_id', _agency_id,
      'lead_id', _lead_id,
      'lead_nome_cliente', _lead_nome,
      'valor_venda', _valor_venda,
      'percentual_comissao', _percentual,
      'valor_comissao', _comissao,
      'contract_id', _contract_id,
      'entrada_transaction_id', _entrada_id,
      'comissao_transaction_id', _despesa_id
    ),
    _actor
  );

  RETURN QUERY
  SELECT _communication_id, _contract_id, _entrada_id, _despesa_id, _percentual, _comissao;
END;
$$;

-- Guarantee default commission row for Diamante
INSERT INTO public.sales_commission_settings (agency_id, percentual)
VALUES ('diamante', 5)
ON CONFLICT (agency_id) DO NOTHING;
