-- Permite qualquer usuário autenticado gerenciar demandas e tasks

-- Demands
DROP POLICY IF EXISTS "Managers can manage demands" ON public.demands;
DROP POLICY IF EXISTS "Authenticated users can read demands" ON public.demands;

CREATE POLICY "Authenticated can manage demands"
  ON public.demands
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Demand tasks
DROP POLICY IF EXISTS "Managers can manage demand tasks" ON public.demand_tasks;
DROP POLICY IF EXISTS "Authenticated users can read demand tasks" ON public.demand_tasks;

CREATE POLICY "Authenticated can manage demand tasks"
  ON public.demand_tasks
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
