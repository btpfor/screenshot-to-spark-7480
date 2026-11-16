REVOKE INSERT, UPDATE ON public.member_dossiers FROM authenticated;
REVOKE SELECT ON public.member_dossiers FROM authenticated;
GRANT SELECT(driver_id,status,first_name,last_name,phone,birth_date,birth_place,sex,address,region,department,commune,secondary_phone,email,identity_type,cni_number,identity_issued,identity_expiry,license_number,license_category,license_issued,license_expiry,original_photo_path,confirmed_photo_path,photo_confirmed,public_photo_consent,certified,member_message,submitted_at,approved_at,adhesion_date,updated_at) ON public.member_dossiers TO authenticated;
CREATE FUNCTION public.review_membership_dossier(_driver uuid,_status text,_message text,_comment text,_adhesion date,_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.member_dossiers;
BEGIN
 IF NOT public.has_any_role(_actor,ARRAY['super_admin','president','secretaire','resp_chauffeurs']::public.app_role[]) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
 SELECT * INTO p FROM public.member_dossiers WHERE driver_id=_driver FOR UPDATE;
 IF p.driver_id IS NULL THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
 IF _status NOT IN ('verification','correction','valide','rejete') THEN RAISE EXCEPTION 'Décision invalide'; END IF;
 IF _status='valide' AND (p.status NOT IN ('soumis','verification') OR NOT p.photo_confirmed OR NOT p.certified OR p.confirmed_photo_path IS NULL OR _adhesion IS NULL) THEN RAISE EXCEPTION 'Dossier soumis et photo confirmée obligatoires'; END IF;
 IF _status IN ('correction','rejete') AND trim(_message)='' THEN RAISE EXCEPTION 'Motif obligatoire'; END IF;
 UPDATE public.member_dossiers SET status=_status,member_message=_message,internal_comment=_comment,approved_at=CASE WHEN _status='valide' THEN now() ELSE approved_at END,adhesion_date=CASE WHEN _status='valide' THEN _adhesion ELSE adhesion_date END WHERE driver_id=_driver;
 IF _status='valide' THEN UPDATE public.drivers SET first_name=p.first_name,last_name=p.last_name,phone=p.phone,address=p.address,birth_date=p.birth_date,cni_number=p.cni_number,license_number=p.license_number,license_expiry=p.license_expiry,photo_url=p.confirmed_photo_path,join_date=_adhesion WHERE id=_driver; END IF;
 INSERT INTO public.audit_log(user_id,action,table_name,record_id) VALUES(_actor,'REVIEW_'||upper(_status),'member_dossiers',_driver::text);
END $$;
REVOKE ALL ON FUNCTION public.review_membership_dossier(uuid,text,text,text,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_membership_dossier(uuid,text,text,text,date,uuid) TO service_role;
CREATE FUNCTION public.issue_membership_card(_driver uuid,_start date,_end date,_reason text,_actor uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.member_dossiers; d public.drivers; s public.membership_settings; cid uuid;
BEGIN
 IF NOT public.has_any_role(_actor,ARRAY['super_admin','president','secretaire','resp_chauffeurs']::public.app_role[]) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
 SELECT * INTO d FROM public.drivers WHERE id=_driver FOR UPDATE;
 SELECT * INTO p FROM public.member_dossiers WHERE driver_id=_driver FOR UPDATE;
 SELECT * INTO s FROM public.membership_settings WHERE id=1;
 IF p.status<>'valide' OR NOT p.photo_confirmed OR p.confirmed_photo_path IS NULL OR p.adhesion_date IS NULL THEN RAISE EXCEPTION 'Dossier validé et photo confirmée obligatoires'; END IF;
 IF d.status<>'actif' OR d.account_status<>'actif' THEN RAISE EXCEPTION 'Le membre doit être actif'; END IF;
 IF _start IS NULL OR _end IS NULL OR _end<_start THEN RAISE EXCEPTION 'Dates de validité obligatoires'; END IF;
 IF s.signature_path IS NULL OR s.stamp_path IS NULL THEN RAISE EXCEPTION 'Ajoutez la signature et le cachet officiels dans les paramètres des cartes'; END IF;
 IF _reason NOT IN ('initial','renewal','loss') THEN RAISE EXCEPTION 'Motif invalide'; END IF;
 UPDATE public.membership_cards SET status='replaced' WHERE driver_id=_driver AND status IN ('active','suspended');
 INSERT INTO public.membership_cards(driver_id,starts_on,expires_on,adhesion_date,reason,first_name,last_name,matricule,photo_path,public_photo_consent,terms,loss_instructions,signature_path,stamp_path) VALUES(_driver,_start,_end,p.adhesion_date,_reason,p.first_name,p.last_name,d.matricule,p.confirmed_photo_path,p.public_photo_consent,s.terms,s.loss_instructions,s.signature_path,s.stamp_path) RETURNING id INTO cid;
 INSERT INTO public.audit_log(user_id,action,table_name,record_id) VALUES(_actor,'CARD_ISSUED','membership_cards',cid::text);
 IF d.user_id IS NOT NULL THEN INSERT INTO public.member_notifications(recipient_id,driver_id,title,message) VALUES(d.user_id,_driver,'Carte disponible','Votre carte est disponible au téléchargement.'); END IF;
 RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.issue_membership_card(uuid,date,date,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_membership_card(uuid,date,date,text,uuid) TO service_role;
CREATE FUNCTION public.public_membership_photo(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.membership_cards c JOIN public.drivers d ON d.id=c.driver_id WHERE c.photo_path=_path AND c.public_photo_consent AND c.status='active' AND d.status='actif' AND d.account_status='actif' AND current_date BETWEEN c.starts_on AND c.expires_on) $$;
REVOKE ALL ON FUNCTION public.public_membership_photo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_membership_photo(text) TO anon,authenticated;
DROP POLICY membership_public_photo ON storage.objects;
CREATE POLICY membership_public_photo ON storage.objects FOR SELECT TO anon USING(bucket_id='photos' AND public.public_membership_photo(name));
CREATE POLICY membership_institution_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='member-documents' AND name LIKE 'institution/%' AND public.membership_manager());
CREATE POLICY membership_institution_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='member-documents' AND name LIKE 'institution/%' AND public.membership_manager());