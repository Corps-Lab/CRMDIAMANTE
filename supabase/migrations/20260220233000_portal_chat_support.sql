-- Portal do Cliente <-> Suporte chat integration
-- Provides protocol/access based portal chat with internal CRM inbox.

CREATE TABLE IF NOT EXISTS public.portal_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  client_document text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'fechado')),
  origin text NOT NULL DEFAULT 'portal'
    CHECK (origin IN ('portal', 'whatsapp', 'interno')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_chat_threads_last_message
  ON public.portal_chat_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_chat_threads_status
  ON public.portal_chat_threads (status);

DROP TRIGGER IF EXISTS update_portal_chat_threads_updated_at ON public.portal_chat_threads;
CREATE TRIGGER update_portal_chat_threads_updated_at
BEFORE UPDATE ON public.portal_chat_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.portal_chat_access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL UNIQUE REFERENCES public.portal_chat_threads(id) ON DELETE CASCADE,
  access_key_hash text NOT NULL,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_chat_access_thread
  ON public.portal_chat_access_keys (thread_id);

CREATE TABLE IF NOT EXISTS public.portal_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.portal_chat_threads(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('cliente', 'suporte', 'sistema')),
  sender_name text,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'portal'
    CHECK (channel IN ('portal', 'whatsapp', 'interno')),
  message text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_by_support boolean NOT NULL DEFAULT false,
  read_by_client boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_chat_messages_thread_created
  ON public.portal_chat_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_portal_chat_messages_unread_support
  ON public.portal_chat_messages (thread_id)
  WHERE sender_type = 'cliente' AND read_by_support = false;

CREATE OR REPLACE FUNCTION public.portal_chat_touch_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.portal_chat_threads
  SET
    last_message_at = NEW.created_at,
    updated_at = now(),
    status = CASE
      WHEN NEW.sender_type = 'cliente' AND status IN ('aguardando_cliente', 'resolvido', 'fechado')
        THEN 'aberto'
      WHEN NEW.sender_type = 'suporte' AND status IN ('aberto', 'em_atendimento')
        THEN 'aguardando_cliente'
      ELSE status
    END
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_chat_touch_thread ON public.portal_chat_messages;
CREATE TRIGGER trg_portal_chat_touch_thread
AFTER INSERT ON public.portal_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.portal_chat_touch_thread();

ALTER TABLE public.portal_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_chat_access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portal chat threads read by support role" ON public.portal_chat_threads;
CREATE POLICY "Portal chat threads read by support role"
  ON public.portal_chat_threads FOR SELECT
  USING (public.can_access('suporte', auth.uid()));

DROP POLICY IF EXISTS "Portal chat threads manage by support role" ON public.portal_chat_threads;
CREATE POLICY "Portal chat threads manage by support role"
  ON public.portal_chat_threads FOR ALL
  USING (public.can_access('suporte', auth.uid()))
  WITH CHECK (public.can_access('suporte', auth.uid()));

DROP POLICY IF EXISTS "Portal chat access keys read by support role" ON public.portal_chat_access_keys;
CREATE POLICY "Portal chat access keys read by support role"
  ON public.portal_chat_access_keys FOR SELECT
  USING (public.can_access('suporte', auth.uid()));

DROP POLICY IF EXISTS "Portal chat access keys manage by support role" ON public.portal_chat_access_keys;
CREATE POLICY "Portal chat access keys manage by support role"
  ON public.portal_chat_access_keys FOR ALL
  USING (public.can_access('suporte', auth.uid()))
  WITH CHECK (public.can_access('suporte', auth.uid()));

DROP POLICY IF EXISTS "Portal chat messages read by support role" ON public.portal_chat_messages;
CREATE POLICY "Portal chat messages read by support role"
  ON public.portal_chat_messages FOR SELECT
  USING (public.can_access('suporte', auth.uid()));

DROP POLICY IF EXISTS "Portal chat messages manage by support role" ON public.portal_chat_messages;
CREATE POLICY "Portal chat messages manage by support role"
  ON public.portal_chat_messages FOR ALL
  USING (public.can_access('suporte', auth.uid()))
  WITH CHECK (public.can_access('suporte', auth.uid()));
