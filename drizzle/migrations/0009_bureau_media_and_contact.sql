ALTER TABLE public.bureau_members ADD COLUMN contact_enabled boolean NOT NULL DEFAULT true;
CREATE POLICY bureau_media_published_read ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id = 'president-media' AND (
    EXISTS (SELECT 1 FROM public.bureau_settings s WHERE s.id = 1 AND s.group_photo_path = storage.objects.name)
    OR EXISTS (SELECT 1 FROM public.bureau_members m WHERE m.published AND m.photo_path = storage.objects.name)
  )
);
CREATE POLICY bureau_media_editor_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'president-media' AND name LIKE 'bureau/%' AND public.has_any_role(auth.uid(), ARRAY['super_admin','president','secretaire']::public.app_role[])
);