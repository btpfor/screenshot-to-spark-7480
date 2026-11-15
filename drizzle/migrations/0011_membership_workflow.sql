CREATE SEQUENCE public.membership_number_seq START WITH 657;
SELECT setval('public.membership_number_seq', greatest(656, coalesce((SELECT max(substring(matricule from '(?i)^vipbgg-([0-9]+)$')::bigint) FROM public.drivers),656)), true);
CREATE FUNCTION public.next_membership_identifier() RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$ SELECT 'VIPBGG-' || nextval('public.membership_number_seq')::text $$;
REVOKE ALL ON FUNCTION public.next_membership_identifier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_membership_identifier() TO service_role;
ALTER TABLE public.drivers ALTER COLUMN matricule SET DEFAULT public.next_membership_identifier();
CREATE UNIQUE INDEX IF NOT EXISTS drivers_matricule_ci ON public.drivers(lower(matricule));
CREATE UNIQUE INDEX IF NOT EXISTS drivers_cni_unique ON public.drivers(lower(trim(cni_number))) WHERE cni_number IS NOT NULL AND trim(cni_number)<>'';
CREATE FUNCTION public.protect_permanent_matricule() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.matricule IS DISTINCT FROM OLD.matricule THEN RAISE EXCEPTION 'Le matricule est permanent.'; END IF; RETURN NEW; END $$;
CREATE TRIGGER permanent_matricule BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.protect_permanent_matricule();
CREATE FUNCTION public.membership_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','president','secretaire','resp_chauffeurs']::public.app_role[]) $$;
CREATE TABLE public.member_dossiers (
 driver_id uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'profil_a_completer',
 first_name text NOT NULL DEFAULT '', last_name text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 birth_date date, birth_place text NOT NULL DEFAULT '', sex text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', region text NOT NULL DEFAULT '', department text NOT NULL DEFAULT '', commune text NOT NULL DEFAULT '', secondary_phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 identity_type text NOT NULL DEFAULT 'CNI', cni_number text, identity_issued date, identity_expiry date,
 license_number text NOT NULL DEFAULT '', license_category text NOT NULL DEFAULT '', license_issued date, license_expiry date,
 original_photo_path text, confirmed_photo_path text, photo_confirmed boolean NOT NULL DEFAULT false, public_photo_consent boolean NOT NULL DEFAULT false,
 certified boolean NOT NULL DEFAULT false, member_message text NOT NULL DEFAULT '', internal_comment text NOT NULL DEFAULT '',
 submitted_at timestamptz, approved_at timestamptz, adhesion_date date, updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dossier_status CHECK(status IN ('profil_a_completer','incomplet','soumis','verification','correction','valide','rejete'))
);
GRANT SELECT, INSERT, UPDATE ON public.member_dossiers TO authenticated;
GRANT ALL ON public.member_dossiers TO service_role;
ALTER TABLE public.member_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY dossier_read ON public.member_dossiers FOR SELECT TO authenticated USING(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=driver_id AND d.user_id=auth.uid()));
CREATE POLICY dossier_insert ON public.member_dossiers FOR INSERT TO authenticated WITH CHECK(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=driver_id AND d.user_id=auth.uid()));
CREATE POLICY dossier_update ON public.member_dossiers FOR UPDATE TO authenticated USING(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=driver_id AND d.user_id=auth.uid()));
CREATE UNIQUE INDEX dossier_cni_unique ON public.member_dossiers(lower(trim(cni_number))) WHERE cni_number IS NOT NULL AND trim(cni_number)<>'';
INSERT INTO public.member_dossiers(driver_id,first_name,last_name,phone,birth_date,address,cni_number,license_number,license_expiry,original_photo_path,confirmed_photo_path)
SELECT id,first_name,last_name,phone,birth_date,coalesce(address,''),cni_number,coalesce(license_number,''),license_expiry,photo_url,photo_url FROM public.drivers;
CREATE TABLE public.member_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('identity','license')), path text NOT NULL UNIQUE, file_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.member_documents TO authenticated;
GRANT ALL ON public.member_documents TO service_role;
ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_read ON public.member_documents FOR SELECT TO authenticated USING(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=driver_id AND d.user_id=auth.uid()));
CREATE POLICY documents_insert ON public.member_documents FOR INSERT TO authenticated WITH CHECK(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d JOIN public.member_dossiers p ON p.driver_id=d.id WHERE d.id=driver_id AND d.user_id=auth.uid() AND p.status IN ('profil_a_completer','incomplet','correction')));
CREATE POLICY documents_delete ON public.member_documents FOR DELETE TO authenticated USING(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d JOIN public.member_dossiers p ON p.driver_id=d.id WHERE d.id=driver_id AND d.user_id=auth.uid() AND p.status IN ('profil_a_completer','incomplet','correction')));
CREATE TABLE public.membership_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), validity_months integer CHECK(validity_months>0 AND validity_months<=120), stamp_path text, signature_path text,
 terms text NOT NULL DEFAULT 'Carte personnelle et non transférable', loss_instructions text NOT NULL DEFAULT '', photo_width_mm integer NOT NULL DEFAULT 35 CHECK(photo_width_mm>0), photo_height_mm integer NOT NULL DEFAULT 45 CHECK(photo_height_mm>0)
);
GRANT SELECT, INSERT, UPDATE ON public.membership_settings TO authenticated;
GRANT ALL ON public.membership_settings TO service_role;
ALTER TABLE public.membership_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_settings_read ON public.membership_settings FOR SELECT TO authenticated USING(true);
CREATE POLICY membership_settings_write ON public.membership_settings FOR ALL TO authenticated USING(public.membership_manager()) WITH CHECK(public.membership_manager());
CREATE TABLE public.membership_cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), driver_id uuid NOT NULL REFERENCES public.drivers(id), token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 issued_at timestamptz NOT NULL DEFAULT now(), starts_on date NOT NULL, expires_on date NOT NULL, adhesion_date date NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','cancelled','replaced')),
 reason text NOT NULL DEFAULT 'initial', first_name text NOT NULL, last_name text NOT NULL, matricule text NOT NULL,
 photo_path text NOT NULL, public_photo_consent boolean NOT NULL DEFAULT false, terms text NOT NULL, loss_instructions text NOT NULL DEFAULT '', signature_path text, stamp_path text,
 CONSTRAINT card_dates CHECK(expires_on>=starts_on)
);
GRANT SELECT ON public.membership_cards TO authenticated;
GRANT ALL ON public.membership_cards TO service_role;
ALTER TABLE public.membership_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY cards_read ON public.membership_cards FOR SELECT TO authenticated USING(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=driver_id AND d.user_id=auth.uid()));
CREATE TABLE public.member_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL, driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
 title text NOT NULL, message text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
GRANT SELECT, UPDATE ON public.member_notifications TO authenticated;
GRANT ALL ON public.member_notifications TO service_role;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read ON public.member_notifications FOR SELECT TO authenticated USING(recipient_id=auth.uid());
CREATE POLICY notifications_update ON public.member_notifications FOR UPDATE TO authenticated USING(recipient_id=auth.uid()) WITH CHECK(recipient_id=auth.uid());
CREATE FUNCTION public.guard_notification_update() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF current_user<>'service_role' AND (NEW.recipient_id IS DISTINCT FROM OLD.recipient_id OR NEW.title IS DISTINCT FROM OLD.title OR NEW.message IS DISTINCT FROM OLD.message OR NEW.driver_id IS DISTINCT FROM OLD.driver_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Modification non autorisée'; END IF; RETURN NEW; END $$;
CREATE TRIGGER notification_guard BEFORE UPDATE ON public.member_notifications FOR EACH ROW EXECUTE FUNCTION public.guard_notification_update();
CREATE FUNCTION public.guard_member_dossier() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user<>'service_role' AND NOT public.membership_manager() THEN
  IF TG_OP='UPDATE' AND OLD.status NOT IN ('profil_a_completer','incomplet','correction') THEN RAISE EXCEPTION 'Ce dossier est verrouillé pendant la vérification.'; END IF;
  IF NEW.status NOT IN ('profil_a_completer','incomplet','correction','soumis') OR NEW.internal_comment<>'' OR NEW.approved_at IS NOT NULL OR NEW.adhesion_date IS NOT NULL THEN RAISE EXCEPTION 'Décision réservée à l’administration.'; END IF;
 END IF;
 IF NEW.cni_number IS NOT NULL AND trim(NEW.cni_number)<>'' AND EXISTS(SELECT 1 FROM public.drivers d WHERE d.id<>NEW.driver_id AND lower(trim(d.cni_number))=lower(trim(NEW.cni_number))) THEN RAISE EXCEPTION 'Cette pièce d’identité est déjà enregistrée.'; END IF;
 IF NEW.status='soumis' AND (NOT NEW.certified OR NOT NEW.photo_confirmed OR NEW.confirmed_photo_path IS NULL OR trim(NEW.first_name)='' OR trim(NEW.last_name)='' OR trim(NEW.phone)='' OR NEW.birth_date IS NULL OR trim(NEW.birth_place)='' OR trim(NEW.address)='' OR trim(NEW.region)='' OR trim(NEW.department)='' OR trim(NEW.commune)='' OR coalesce(trim(NEW.cni_number),'')='' OR trim(NEW.license_number)='' OR trim(NEW.license_category)='') THEN RAISE EXCEPTION 'Complétez et certifiez toutes les informations obligatoires avant de soumettre.'; END IF;
 IF TG_OP='UPDATE' AND NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN RAISE EXCEPTION 'Dossier permanent'; END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER dossier_guard BEFORE INSERT OR UPDATE ON public.member_dossiers FOR EACH ROW EXECUTE FUNCTION public.guard_member_dossier();
CREATE FUNCTION public.membership_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; label text;
BEGIN
 SELECT user_id INTO uid FROM public.drivers WHERE id=NEW.driver_id;
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
 label=CASE NEW.status WHEN 'soumis' THEN 'Dossier soumis' WHEN 'verification' THEN 'Dossier en cours de vérification' WHEN 'correction' THEN 'Correction demandée' WHEN 'valide' THEN 'Dossier validé' WHEN 'rejete' THEN 'Dossier rejeté' ELSE 'Profil à compléter' END;
 IF uid IS NOT NULL THEN INSERT INTO public.member_notifications(recipient_id,driver_id,title,message) VALUES(uid,NEW.driver_id,label,NEW.member_message); END IF;
 INSERT INTO public.member_notifications(recipient_id,driver_id,title) SELECT DISTINCT r.user_id,NEW.driver_id,label FROM public.user_roles r WHERE r.role IN ('super_admin','president','secretaire','resp_chauffeurs');
 INSERT INTO public.audit_log(user_id,action,table_name,record_id) VALUES(auth.uid(), 'DOSSIER_'||upper(NEW.status),'member_dossiers',NEW.driver_id::text);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER dossier_notification AFTER INSERT OR UPDATE ON public.member_dossiers FOR EACH ROW EXECUTE FUNCTION public.membership_notify();
CREATE FUNCTION public.verify_membership_card(_token uuid) RETURNS TABLE(first_name text,last_name text,matricule text,adhesion_date date,starts_on date,expires_on date,card_status text,photo_path text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.first_name,c.last_name,c.matricule,c.adhesion_date,c.starts_on,c.expires_on,
 CASE WHEN c.status IN ('cancelled','replaced') THEN 'invalide' WHEN c.status='suspended' OR d.status<>'actif' OR d.account_status<>'actif' THEN 'suspendue' WHEN current_date>c.expires_on THEN 'expiree' WHEN current_date<c.starts_on THEN 'invalide' ELSE 'valide' END,
 CASE WHEN c.public_photo_consent AND c.status='active' AND d.status='actif' AND current_date BETWEEN c.starts_on AND c.expires_on THEN c.photo_path ELSE NULL END
 FROM public.membership_cards c JOIN public.drivers d ON d.id=c.driver_id WHERE c.token=_token;
$$;
REVOKE ALL ON FUNCTION public.verify_membership_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_membership_card(uuid) TO anon,authenticated,service_role;
CREATE POLICY membership_photo_owner_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='photos' AND (public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.user_id=auth.uid() AND (d.photo_url=name OR split_part(name,'/',1)=d.id::text))));
DROP POLICY "auth read photos" ON storage.objects;
CREATE POLICY membership_photo_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='photos' AND EXISTS(SELECT 1 FROM public.drivers d JOIN public.member_dossiers p ON p.driver_id=d.id WHERE d.user_id=auth.uid() AND split_part(name,'/',1)=d.id::text AND p.status IN ('profil_a_completer','incomplet','correction')));
CREATE POLICY membership_document_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='member-documents' AND (public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.user_id=auth.uid() AND split_part(name,'/',1)=d.id::text)));
CREATE POLICY membership_document_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='member-documents' AND (public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d JOIN public.member_dossiers p ON p.driver_id=d.id WHERE d.user_id=auth.uid() AND split_part(name,'/',1)=d.id::text AND p.status IN ('profil_a_completer','incomplet','correction'))));
CREATE POLICY membership_public_photo ON storage.objects FOR SELECT TO anon USING(bucket_id='photos' AND EXISTS(SELECT 1 FROM public.membership_cards c JOIN public.drivers d ON d.id=c.driver_id WHERE c.photo_path=name AND c.public_photo_consent AND c.status='active' AND d.status='actif' AND d.account_status='actif' AND current_date BETWEEN c.starts_on AND c.expires_on));