-- Storage bucket for portal chat attachments (images, videos and documents)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('portal-chat', 'portal-chat', true, 20971520)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Portal chat support upload'
  ) THEN
    DROP POLICY "Portal chat support upload" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Portal chat support upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portal-chat'
    AND public.can_access('suporte', auth.uid())
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Portal chat support update'
  ) THEN
    DROP POLICY "Portal chat support update" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Portal chat support update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'portal-chat'
    AND public.can_access('suporte', auth.uid())
  )
  WITH CHECK (
    bucket_id = 'portal-chat'
    AND public.can_access('suporte', auth.uid())
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Portal chat support delete'
  ) THEN
    DROP POLICY "Portal chat support delete" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Portal chat support delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portal-chat'
    AND public.can_access('suporte', auth.uid())
  );
