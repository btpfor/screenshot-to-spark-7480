CREATE OR REPLACE FUNCTION public.guard_member_dossier() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF current_user NOT IN ('service_role','postgres') AND NOT public.membership_manager() THEN
 IF TG_OP='UPDATE' AND OLD.status NOT IN ('profil_a_completer','incomplet','correction') THEN RAISE EXCEPTION 'Ce dossier est verrouillé pendant la vérification.'; END IF;
 IF NEW.status NOT IN ('profil_a_completer','incomplet','correction','soumis') OR NEW.internal_comment<>'' OR NEW.approved_at IS NOT NULL OR NEW.adhesion_date IS NOT NULL THEN RAISE EXCEPTION 'Décision réservée à l’administration.'; END IF; END IF;
 IF NEW.cni_number IS NOT NULL AND trim(NEW.cni_number)<>'' AND EXISTS(SELECT 1 FROM public.drivers d WHERE d.id<>NEW.driver_id AND lower(trim(d.cni_number))=lower(trim(NEW.cni_number))) THEN RAISE EXCEPTION 'Cette pièce d’identité est déjà enregistrée.'; END IF;
 IF NEW.photo_confirmed AND (NEW.confirmed_photo_path IS NULL OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='photos' AND o.name=NEW.confirmed_photo_path)) THEN RAISE EXCEPTION 'Photo confirmée introuvable'; END IF;
 IF NEW.status='soumis' AND (NOT NEW.certified OR NOT NEW.photo_confirmed OR NEW.confirmed_photo_path IS NULL OR trim(NEW.first_name)='' OR trim(NEW.last_name)='' OR NEW.phone !~ '^\+?[0-9 ]{7,20}$' OR NEW.birth_date IS NULL OR trim(NEW.birth_place)='' OR trim(NEW.address)='' OR trim(NEW.region)='' OR trim(NEW.department)='' OR trim(NEW.commune)='' OR coalesce(trim(NEW.cni_number),'')='' OR trim(NEW.license_number)='' OR trim(NEW.license_category)='') THEN RAISE EXCEPTION 'Complétez et certifiez les informations obligatoires'; END IF;
 IF TG_OP='UPDATE' AND NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN RAISE EXCEPTION 'Dossier permanent'; END IF;
 NEW.updated_at=now(); RETURN NEW; END $$;
DROP POLICY documents_insert ON public.member_documents;
CREATE POLICY documents_insert ON public.member_documents FOR INSERT TO authenticated WITH CHECK((public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d JOIN public.member_dossiers p ON p.driver_id=d.id WHERE d.id=member_documents.driver_id AND d.user_id=auth.uid() AND p.status IN ('profil_a_completer','incomplet','correction'))) AND split_part(path,'/',1)=member_documents.driver_id::text);
DROP POLICY documents_delete ON public.member_documents;
CREATE POLICY documents_delete ON public.member_documents FOR DELETE TO authenticated USING(public.membership_manager() OR EXISTS(SELECT 1 FROM public.drivers d JOIN public.member_dossiers p ON p.driver_id=d.id WHERE d.id=member_documents.driver_id AND d.user_id=auth.uid() AND p.status IN ('profil_a_completer','incomplet','correction')));
CREATE FUNCTION public.membership_card_status(_card uuid,_driver uuid,_status text,_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.drivers; c public.membership_cards;
BEGIN
 IF NOT public.has_any_role(_actor,ARRAY['super_admin','president','secretaire','resp_chauffeurs']::public.app_role[]) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
 SELECT * INTO c FROM public.membership_cards WHERE id=_card AND driver_id=_driver FOR UPDATE;
 SELECT * INTO d FROM public.drivers WHERE id=_driver;
 IF c.id IS NULL OR _status NOT IN ('active','suspended','cancelled') THEN RAISE EXCEPTION 'Carte ou statut invalide'; END IF;
 IF c.status IN ('cancelled','replaced') THEN RAISE EXCEPTION 'Une carte annulée ou remplacée ne peut plus être réactivée'; END IF;
 IF _status='active' AND (d.status<>'actif' OR d.account_status<>'actif') THEN RAISE EXCEPTION 'Le membre doit être actif'; END IF;
 UPDATE public.membership_cards SET status=_status WHERE id=_card;
 INSERT INTO public.audit_log(user_id,action,table_name,record_id) VALUES(_actor,'CARD_'||upper(_status),'membership_cards',_card::text);
 IF d.user_id IS NOT NULL THEN INSERT INTO public.member_notifications(recipient_id,driver_id,title,message) VALUES(d.user_id,_driver,'Statut de carte modifié',CASE _status WHEN 'active' THEN 'Votre carte est réactivée.' WHEN 'suspended' THEN 'Votre carte est suspendue.' ELSE 'Votre carte est annulée.' END); END IF;
END $$;
REVOKE ALL ON FUNCTION public.membership_card_status(uuid,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.membership_card_status(uuid,uuid,text,uuid) TO service_role;