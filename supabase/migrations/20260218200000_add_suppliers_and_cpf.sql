-- Add CPF column to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cpf text;

-- Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  doc_tipo text NOT NULL CHECK (doc_tipo IN ('cpf','cnpj')),
  documento text NOT NULL UNIQUE,
  endereco text,
  responsavel text,
  contato text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read suppliers"
  ON public.suppliers FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage suppliers"
  ON public.suppliers FOR ALL
  USING (public.is_manager(auth.uid()));

CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
