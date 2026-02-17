-- Permitir qualquer usuário autenticado gerenciar transações (entradas/despesas)

DROP POLICY IF EXISTS "Managers can manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON public.transactions;

CREATE POLICY "Authenticated can manage transactions"
  ON public.transactions
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
