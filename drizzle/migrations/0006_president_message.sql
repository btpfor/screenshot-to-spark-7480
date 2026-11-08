CREATE TABLE public.president_message (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 name text NOT NULL,
 role_label text NOT NULL,
 body text NOT NULL,
 photo_path text,
 signature_path text,
 published boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.president_message TO anon;
GRANT SELECT, UPDATE ON public.president_message TO authenticated;
GRANT ALL ON public.president_message TO service_role;
ALTER TABLE public.president_message ENABLE ROW LEVEL SECURITY;
CREATE POLICY president_public_read ON public.president_message FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY president_editor_read ON public.president_message FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'president') OR public.has_role(auth.uid(), 'secretaire'));
CREATE POLICY president_editor_update ON public.president_message FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'president') OR public.has_role(auth.uid(), 'secretaire')) WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'president') OR public.has_role(auth.uid(), 'secretaire'));
INSERT INTO public.president_message (id, name, role_label, body, photo_path, published)
SELECT 1, 'Badara Ndiaye', 'Président du GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL.', $message$Chers membres, chers partenaires et chers visiteurs,

C'est avec un immense honneur et un profond sens des responsabilités que je m'adresse à vous au nom du GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL.

Notre groupement est né d'une conviction forte : l'union fait la force. Nous sommes convaincus que la solidarité, la discipline et l'entraide constituent les fondements d'une organisation durable et prospère.

Notre ambition est de construire un GIE fort, structuré et dynamique, capable de défendre les intérêts de ses membres et d'améliorer leurs conditions de travail et de vie.

Nous travaillons notamment à faciliter l'accès aux véhicules, développer des partenariats stratégiques avec des fournisseurs nationaux et internationaux, rechercher des solutions de financement et accompagner la modernisation du secteur du transport au Sénégal.

Nous voulons faire de notre organisation un véritable cadre d'opportunités économiques, de solidarité et de développement pour l'ensemble de nos membres.

Je tiens à remercier tous les chauffeurs, les membres du bureau, nos partenaires et toutes les personnes qui contribuent à la réalisation de cette vision.

Ensemble, poursuivons notre engagement avec détermination, transparence et responsabilité.

L'union fait la force – Solidarité, Discipline et Entraide.$message$, '/__l5e/assets-v1/1b56b485-990f-4de9-9a54-8e8f1ff97e92/portrait-badara-ndiaye.png', true
FROM public.gie_settings WHERE id = 1;
CREATE POLICY president_media_editor_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'president-media' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'president') OR public.has_role(auth.uid(), 'secretaire')));
CREATE POLICY president_media_published_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'president-media' AND EXISTS (SELECT 1 FROM public.president_message p WHERE p.published AND (p.photo_path = name OR p.signature_path = name)));
CREATE POLICY president_media_editor_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'president-media' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'president') OR public.has_role(auth.uid(), 'secretaire')));