ALTER POLICY "public read settings" ON public.gie_settings USING (id = 1);
ALTER POLICY "bureau_settings_public_read" ON public.bureau_settings USING (id = 1);
ALTER POLICY "membership_settings_read" ON public.membership_settings TO authenticated USING (public.membership_manager());