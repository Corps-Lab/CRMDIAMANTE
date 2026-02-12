-- Allow qualquer usuário autenticado a inserir/atualizar/excluir clientes
-- (mantém leitura já existente)

DROP POLICY IF EXISTS "Managers can manage clients" ON public.clients;

CREATE POLICY "Authenticated can manage clients"
  ON public.clients
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
